/**
 * LeadProcessManager — Orchestratore unico per il lifecycle dei lead.
 *
 * RESPONSABILITÀ:
 *   Riceve DomainEvent → Decide transizioni → Applica via guard → Pubblica LeadStatusChanged.
 *
 * REGOLA D'ORO:
 *   Nessun altro modulo muta lead_status. Tutti pubblicano eventi, questo PM reagisce.
 *
 * ASSORBE:
 *   - stateTransitions.ts (gate automatici: new→first_touch_sent, reply→engaged, etc.)
 *   - leadStatusUpdater.ts (post-send: new→first_touch_sent)
 *   - decisionEngine/evaluator.ts (phase 0: auto-apply transitions)
 *   - on_inbound_message trigger (reply→engaged, pending→skipped)
 *
 * DELEGA:
 *   - leadStatusGuard.ts rimane il guard di validazione + audit (write layer)
 *   - cadenceEngine.ts rimane il guard temporale (quando contattare)
 *   - decisionEngine/decider.ts rimane il suggeritore di azioni (cosa fare next)
 *
 * PATTERN: Saga / Process Manager (DDD), Event-Driven
 */

import { applyLeadStatusChange, type ApplyLeadStatusResult } from "../leadStatusGuard.ts";
import {
  eventBus,
  createEvent,
  publishAndPersist,
  type WCADomainEvent,
  type LeadStatus,
  type EventActor,
} from "../domainEvents.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ═══════════════════════════════════════════════════════════
//  TRANSITION RULES — Canonical gates
// ═══════════════════════════════════════════════════════════

interface TransitionRule {
  fromStatus: LeadStatus | "*";
  toStatus: LeadStatus;
  trigger: string;
  autoApply: boolean;
  /** Condition function — receives partner state, returns true if gate is open */
  condition: (ctx: LeadContext) => boolean;
}

interface LeadContext {
  currentStatus: LeadStatus;
  daysSinceLastOutbound: number;
  daysSinceLastInbound: number | null;
  outboundCount: number;
  hasRecentInbound: boolean;
  hasRecentReply: boolean;
}

const TRANSITION_RULES: TransitionRule[] = [
  // ── Auto-apply gates (sistema decide) ──
  {
    fromStatus: "new",
    toStatus: "first_touch_sent",
    trigger: "Primo messaggio inviato",
    autoApply: true,
    condition: (ctx) => ctx.outboundCount > 0,
  },
  {
    fromStatus: "first_touch_sent",
    toStatus: "engaged",
    trigger: "Risposta ricevuta",
    autoApply: true,
    condition: (ctx) => ctx.hasRecentReply,
  },
  {
    fromStatus: "first_touch_sent",
    toStatus: "holding",
    trigger: "3+ giorni senza risposta",
    autoApply: true,
    condition: (ctx) => ctx.daysSinceLastOutbound >= 3 && !ctx.hasRecentInbound,
  },
  {
    fromStatus: "holding",
    toStatus: "engaged",
    trigger: "Risposta ricevuta dopo holding",
    autoApply: true,
    condition: (ctx) => ctx.hasRecentReply,
  },
  // ── Manual gates (richiedono approvazione Director) ──
  {
    fromStatus: "holding",
    toStatus: "archived",
    trigger: "90+ giorni, 3+ tentativi — richiede approvazione",
    autoApply: false,
    condition: (ctx) => ctx.daysSinceLastOutbound >= 90 && ctx.outboundCount >= 3,
  },
];

// ═══════════════════════════════════════════════════════════
//  CORE — Process Manager
// ═══════════════════════════════════════════════════════════

export class LeadProcessManager {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Register event handlers on the EventBus.
   * Call this once at the start of request processing.
   */
  register(): void {
    // Email sent → maybe new→first_touch_sent
    eventBus.on("email.sent", async (event) => {
      if (!event.payload.partnerId) return;
      await this.onOutboundSent(
        event.payload.partnerId,
        event.userId,
        event.payload.channel,
        event.payload.sequenceDay,
        event.correlationId,
        event.eventId,
      );
    });

    // Inbound received → maybe first_touch_sent/holding→engaged
    eventBus.on("email.inbound_received", async (event) => {
      if (!event.payload.partnerId) return;
      await this.onInboundReceived(
        event.payload.partnerId,
        event.userId,
        event.payload.channel,
        event.correlationId,
        event.eventId,
      );
    });

    // Email classified → check for qualification/conversion signals
    eventBus.on("email.classified", async (event) => {
      if (!event.payload.partnerId) return;
      await this.onEmailClassified(
        event.payload.partnerId,
        event.userId,
        event.payload.category,
        event.payload.actionSuggested,
        event.correlationId,
        event.eventId,
      );
    });

    // Outreach executed → same as email sent for status purposes
    eventBus.on("outreach.executed", async (event) => {
      if (!event.payload.success) return;
      await this.onOutboundSent(
        event.payload.partnerId,
        event.userId,
        event.payload.channel,
        undefined,
        event.correlationId,
        event.eventId,
      );
    });

    // Outreach replied → same as inbound for status purposes
    eventBus.on("outreach.replied", async (event) => {
      await this.onInboundReceived(
        event.payload.partnerId,
        event.userId,
        event.payload.channel,
        event.correlationId,
        event.eventId,
      );
    });
  }

  // ── Event Handlers ──

  /**
   * Handle outbound message sent.
   * Gate: new → first_touch_sent (auto)
   */
  private async onOutboundSent(
    partnerId: string,
    userId: string,
    channel: string,
    sequenceDay?: number,
    correlationId?: string,
    causationId?: string,
  ): Promise<void> {
    const current = await this.loadCurrentStatus(partnerId, userId);
    if (!current) return;

    if (current === "new") {
      await this.applyAndPublish(partnerId, userId, current, "first_touch_sent", {
        trigger: `Primo messaggio inviato (${channel})`,
        autoApplied: true,
        actor: { type: "system", name: "LeadProcessManager" },
        correlationId,
        causationId,
        metadata: { channel, sequence_day: sequenceDay ?? 0 },
      });
    } else {
      // Stato avanzato: aggiorna solo timestamp
      await this.supabase
        .from("partners")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("id", partnerId)
        .eq("user_id", userId);
    }
  }

  /**
   * Handle inbound message received.
   * Gates: first_touch_sent → engaged, holding → engaged (auto)
   */
  private async onInboundReceived(
    partnerId: string,
    userId: string,
    channel: string,
    correlationId?: string,
    causationId?: string,
  ): Promise<void> {
    const current = await this.loadCurrentStatus(partnerId, userId);
    if (!current) return;

    if (current === "first_touch_sent" || current === "holding") {
      await this.applyAndPublish(partnerId, userId, current, "engaged", {
        trigger: `Risposta ricevuta (${channel})${current === "holding" ? " dopo holding" : ""}`,
        autoApplied: true,
        actor: { type: "system", name: "LeadProcessManager" },
        correlationId,
        causationId,
        metadata: { channel, previous_status: current },
      });
    }
  }

  /**
   * Handle email classified — detect qualification/conversion signals.
   */
  private async onEmailClassified(
    partnerId: string,
    userId: string,
    category: string,
    actionSuggested: string | undefined,
    correlationId?: string,
    causationId?: string,
  ): Promise<void> {
    const operativeCategories = ["quote_request", "booking_request", "rate_inquiry"];
    if (operativeCategories.includes(category)) {
      // Publish qualification signal (non auto-apply — Director decides)
      const event = createEvent("lead.qualification_signal", userId,
        { type: "system", name: "LeadProcessManager" },
        {
          partnerId,
          signalType: category as "quote_request" | "booking_request" | "rate_inquiry",
          confidence: 0.8,
        },
        { correlationId, causationId },
      );
      await publishAndPersist(this.supabase, event);
    }

    if (category === "conversion_signal" || actionSuggested === "confirm_conversion") {
      const event = createEvent("lead.conversion_signal", userId,
        { type: "system", name: "LeadProcessManager" },
        {
          partnerId,
          evidenceType: "manual_confirmation",
        },
        { correlationId, causationId },
      );
      await publishAndPersist(this.supabase, event);
    }
  }

  /**
   * Cron evaluation — run all time-based transition rules.
   * Called by agent-autonomous-cycle or a dedicated cron.
   */
  async evaluateTimeBasedTransitions(
    partnerId: string,
    userId: string,
  ): Promise<Array<{ from: string; to: string; trigger: string; applied: boolean }>> {
    const results: Array<{ from: string; to: string; trigger: string; applied: boolean }> = [];

    const current = await this.loadCurrentStatus(partnerId, userId);
    if (!current) return results;

    // Load context for condition evaluation
    const ctx = await this.loadLeadContext(partnerId, userId, current);

    for (const rule of TRANSITION_RULES) {
      if (rule.fromStatus !== "*" && rule.fromStatus !== current) continue;
      if (!rule.condition(ctx)) continue;

      if (rule.autoApply) {
        const res = await this.applyAndPublish(partnerId, userId, current, rule.toStatus, {
          trigger: rule.trigger,
          autoApplied: true,
          actor: { type: "cron", name: "LeadProcessManager/cron" },
        });
        results.push({ from: current, to: rule.toStatus, trigger: rule.trigger, applied: res.applied });
        if (res.applied) break; // Only one transition per evaluation
      } else {
        // Non-auto: publish as suggestion for Director approval
        results.push({ from: current, to: rule.toStatus, trigger: rule.trigger, applied: false });
      }
    }

    return results;
  }

  /**
   * Manual transition — called by UI or agent tools.
   * Validates and applies with full audit trail.
   */
  async requestTransition(
    partnerId: string,
    userId: string,
    newStatus: LeadStatus,
    opts: {
      trigger: string;
      reason?: string;
      actor: EventActor;
      decisionOrigin: string;
      correlationId?: string;
    },
  ): Promise<ApplyLeadStatusResult> {
    const current = await this.loadCurrentStatus(partnerId, userId);
    if (!current) {
      return { applied: false, previousStatus: null, newStatus, blockedReason: "Partner non trovato" };
    }

    return this.applyAndPublish(partnerId, userId, current, newStatus, {
      trigger: opts.trigger,
      autoApplied: false,
      actor: opts.actor,
      reason: opts.reason,
      decisionOrigin: opts.decisionOrigin,
      correlationId: opts.correlationId,
    });
  }

  // ── Internal helpers ──

  private async loadCurrentStatus(partnerId: string, userId: string): Promise<LeadStatus | null> {
    const { data } = await this.supabase
      .from("partners")
      .select("lead_status")
      .eq("id", partnerId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    return ((data as { lead_status: string | null }).lead_status || "new") as LeadStatus;
  }

  private async loadLeadContext(
    partnerId: string,
    userId: string,
    currentStatus: LeadStatus,
  ): Promise<LeadContext> {
    // Last outbound
    const { data: lastOut } = await this.supabase
      .from("activities")
      .select("created_at")
      .eq("partner_id", partnerId)
      .eq("user_id", userId)
      .in("activity_type", ["send_email", "whatsapp_message", "linkedin_message"])
      .order("created_at", { ascending: false })
      .limit(1);

    const daysSinceLastOutbound = lastOut?.[0]?.created_at
      ? Math.floor((Date.now() - new Date(lastOut[0].created_at).getTime()) / 86400000)
      : 999;

    // Last inbound
    const { data: lastIn } = await this.supabase
      .from("channel_messages")
      .select("created_at")
      .eq("partner_id", partnerId)
      .eq("user_id", userId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1);

    const daysSinceLastInbound = lastIn?.[0]?.created_at
      ? Math.floor((Date.now() - new Date(lastIn[0].created_at).getTime()) / 86400000)
      : null;

    const hasRecentInbound = daysSinceLastInbound !== null && daysSinceLastInbound <= 7;

    // Outbound count
    const { count: outboundCount } = await this.supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .eq("user_id", userId)
      .in("activity_type", ["send_email", "whatsapp_message", "linkedin_message"]);

    // Has recent reply (direct reply to our outreach)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: replyCount } = await this.supabase
      .from("channel_messages")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .eq("user_id", userId)
      .eq("direction", "inbound")
      .gte("created_at", sevenDaysAgo);

    return {
      currentStatus,
      daysSinceLastOutbound,
      daysSinceLastInbound,
      outboundCount: outboundCount ?? 0,
      hasRecentInbound,
      hasRecentReply: (replyCount ?? 0) > 0,
    };
  }

  /**
   * Core: apply transition via guard, then publish LeadStatusChanged event.
   */
  private async applyAndPublish(
    partnerId: string,
    userId: string,
    previousStatus: LeadStatus,
    newStatus: LeadStatus,
    opts: {
      trigger: string;
      autoApplied: boolean;
      actor: EventActor;
      reason?: string;
      decisionOrigin?: string;
      correlationId?: string;
      causationId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ApplyLeadStatusResult> {
    // Apply via the guard (validation + audit)
    const result = await applyLeadStatusChange(this.supabase, {
      table: "partners",
      recordId: partnerId,
      newStatus,
      userId,
      actor: { type: opts.actor.type as "user" | "ai_agent" | "system" | "cron", name: opts.actor.name },
      decisionOrigin: (opts.decisionOrigin || (opts.autoApplied ? "system_trigger" : "manual")) as
        "manual" | "ai_auto" | "ai_approved" | "system_cron" | "system_trigger",
      trigger: opts.trigger,
      reason: opts.reason,
      metadata: opts.metadata,
    });

    if (result.applied) {
      // Publish domain event
      const event = createEvent("lead.status_changed", userId, opts.actor, {
        partnerId,
        previousStatus: previousStatus as LeadStatus,
        newStatus: newStatus as LeadStatus,
        trigger: opts.trigger,
        autoApplied: opts.autoApplied,
      }, {
        correlationId: opts.correlationId,
        causationId: opts.causationId,
        metadata: opts.metadata,
      });

      await publishAndPersist(this.supabase, event);
    }

    return result;
  }
}

// ═══════════════════════════════════════════════════════════
//  FACTORY — Create and register in one call
// ═══════════════════════════════════════════════════════════

/**
 * Create a LeadProcessManager and register it on the EventBus.
 * Call this at the start of any edge function that deals with lead lifecycle.
 *
 * Usage:
 *   const leadPM = initLeadProcessManager(supabase);
 *   // ... publish events ...
 *   // PM will automatically react to EmailSent, InboundReceived, etc.
 */
export function initLeadProcessManager(supabase: SupabaseClient): LeadProcessManager {
  const pm = new LeadProcessManager(supabase);
  pm.register();
  return pm;
}

/**
 * EmailProcessManager — Orchestratore unico per il dominio Email.
 *
 * RESPONSABILITÀ:
 *   Riceve DomainEvent → Coordina classificazione, routing, risposta.
 *   Pubblica eventi downstream per LeadPM e OutreachPM.
 *
 * REGOLA D'ORO:
 *   Tutte le mutazioni email-domain (email_classifications, email_address_rules,
 *   channel_messages status) passano da questo PM. I moduli handler restano
 *   come librerie di dominio, ma il PM è l'unico punto di entrata.
 *
 * ASSORBE:
 *   - postClassificationPipeline.ts (orchestrazione post-classificazione)
 *   - emailRouter.ts (routing commerciale → viene delegato, non duplicato)
 *   - domainHandler.ts (routing non-commerciale → viene delegato)
 *   - bounceAndUnsubscribeHandler.ts (bounce/unsub → pubblica EmailBounceDetected)
 *
 * DELEGA (non assorbe, chiama):
 *   - classificationRules.ts (caricamento regole, generazione draft)
 *   - senderGrouping.ts (suggerimenti gruppi)
 *   - emailRouter.ts / domainHandler.ts / bounceAndUnsubscribeHandler.ts (logica handler)
 *
 * PUBBLICA:
 *   - email.classified → LeadPM reagisce (qualification/conversion signals)
 *   - email.bounce_detected → LeadPM reagisce (blacklist/archive)
 *   - email.inbound_received → LeadPM reagisce (engagement transitions)
 *
 * PATTERN: Process Manager (DDD), Event-Driven
 */

import {
  eventBus,
  createEvent,
  publishAndPersist,
  type WCADomainEvent,
  type EventActor,
} from "../domainEvents.ts";
import {
  runPostClassificationPipeline,
  type ClassificationInput,
  type ClassificationCategory,
  type ClassificationDomain,
  type PostClassificationResult,
} from "../postClassificationPipeline.ts";
import { loadEmailAddressRules } from "../classificationRules.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

export interface EmailClassificationContext {
  messageId: string;
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
  senderEmail: string;
  senderName?: string;
  subject?: string;
  aiSummary?: string;
  category: ClassificationCategory;
  confidence: number;
  urgency?: string;
  sentiment?: string;
  domain?: ClassificationDomain;
  channel?: "email" | "whatsapp" | "linkedin";
  oooReturnDate?: string;
}

export interface EmailProcessManagerResult {
  /** Results from the classification pipeline */
  pipelineResult: PostClassificationResult;
  /** Events published during processing */
  eventsPublished: string[];
}

// ═══════════════════════════════════════════════════════════
//  CORE — Process Manager
// ═══════════════════════════════════════════════════════════

export class EmailProcessManager {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Register event handlers on the EventBus.
   * Call this once at the start of request processing.
   *
   * EmailPM reacts to:
   *   - email.inbound_received → triggers classification pipeline
   *   - email.classified → publishes downstream events for LeadPM
   *   - email.bounce_detected → publishes blacklist/archive events
   */
  register(): void {
    // When an inbound email is received and already classified,
    // process the classification result
    eventBus.on("email.classified", async (event) => {
      await this.onEmailClassified(event);
    });

    // When a bounce is detected, handle email hygiene
    eventBus.on("email.bounce_detected", async (event) => {
      await this.onBounceDetected(event);
    });
  }

  // ── Event Handlers ──

  /**
   * React to email.classified — log classification result.
   * The actual pipeline work is done via processClassification() which is
   * called directly by classify-inbound-message after AI classification.
   */
  private async onEmailClassified(
    event: Extract<WCADomainEvent, { type: "email.classified" }>,
  ): Promise<void> {
    // Log that we processed this classification
    console.log(
      `[EmailPM] Processed classification for message ${event.payload.messageId}: ` +
      `category=${event.payload.category}, confidence=${event.payload.confidence}`,
    );
  }

  /**
   * React to email.bounce_detected — ensure email hygiene actions.
   */
  private async onBounceDetected(
    event: Extract<WCADomainEvent, { type: "email.bounce_detected" }>,
  ): Promise<void> {
    const { contactEmail, bounceType, partnerId } = event.payload;

    // Mark email as bounced across all tables
    const email = contactEmail.toLowerCase().trim();
    try {
      await this.supabase
        .from("imported_contacts")
        .update({ email_status: "bounced" })
        .ilike("email", email);
      await this.supabase
        .from("partners")
        .update({ email_status: "bounced" })
        .ilike("email", email);
    } catch (e) {
      console.warn("[EmailPM] bounce mark failed:", e);
    }

    // Create archive rule for hard bounces
    if (bounceType === "hard") {
      try {
        await this.supabase.from("email_address_rules").upsert(
          {
            user_id: event.userId,
            email_address: email,
            auto_action: "archive",
            reason: "hard_bounce_detected",
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id,email_address" },
        );
      } catch {
        // Table might not exist yet
      }
    }

    console.log(
      `[EmailPM] Bounce processed: ${email} (${bounceType})` +
      `${partnerId ? ` partner=${partnerId}` : ""}`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  PUBLIC API — Single entry point for classification
  // ═══════════════════════════════════════════════════════════

  /**
   * Process an inbound message classification.
   * This is the SINGLE ENTRY POINT that replaces direct calls to
   * runPostClassificationPipeline.
   *
   * Flow:
   *   1. Publish email.classified event (LeadPM reacts for qualification signals)
   *   2. Run the classification pipeline (handlers for each category)
   *   3. Publish email.bounce_detected if bounce/unsubscribe
   *   4. Return combined result
   *
   * Callers: classify-inbound-message, check-inbox post-classification
   */
  async processClassification(
    ctx: EmailClassificationContext,
  ): Promise<EmailProcessManagerResult> {
    const eventsPublished: string[] = [];
    const actor: EventActor = { type: "system", name: "EmailProcessManager" };

    // ── Step 1: Publish email.classified event ──
    // LeadPM subscribes to this for qualification/conversion signal detection
    const classifiedEvent = createEvent("email.classified", ctx.userId, actor, {
      messageId: ctx.messageId,
      partnerId: ctx.partnerId || null,
      category: ctx.category,
      confidence: ctx.confidence,
      urgency: ctx.urgency || "normal",
      sentiment: ctx.sentiment || "neutral",
      actionSuggested: this.inferAction(ctx.category),
    });
    await publishAndPersist(this.supabase, classifiedEvent);
    eventsPublished.push("email.classified");

    // ── Step 2: Run the classification pipeline (existing handler logic) ──
    const classificationInput: ClassificationInput = {
      userId: ctx.userId,
      partnerId: ctx.partnerId,
      contactId: ctx.contactId,
      category: ctx.category,
      confidence: ctx.confidence,
      senderEmail: ctx.senderEmail,
      senderName: ctx.senderName,
      subject: ctx.subject,
      aiSummary: ctx.aiSummary,
      urgency: ctx.urgency ? this.urgencyToNumber(ctx.urgency) : undefined,
      sentiment: ctx.sentiment,
      channel: ctx.channel,
      oooReturnDate: ctx.oooReturnDate,
      domain: ctx.domain,
    };

    const pipelineResult = await runPostClassificationPipeline(
      this.supabase,
      classificationInput,
    );

    // ── Step 3: Publish bounce/unsubscribe events ──
    if (ctx.category === "bounce") {
      const bounceEvent = createEvent("email.bounce_detected", ctx.userId, actor, {
        contactEmail: ctx.senderEmail,
        partnerId: ctx.partnerId || undefined,
        bounceType: "hard",
        rawReason: ctx.aiSummary,
      }, {
        correlationId: classifiedEvent.correlationId,
        causationId: classifiedEvent.eventId,
      });
      await publishAndPersist(this.supabase, bounceEvent);
      eventsPublished.push("email.bounce_detected");
    }

    if (ctx.category === "unsubscribe") {
      const unsubEvent = createEvent("email.bounce_detected", ctx.userId, actor, {
        contactEmail: ctx.senderEmail,
        partnerId: ctx.partnerId || undefined,
        bounceType: "unsubscribe",
        rawReason: "Explicit unsubscribe request",
      }, {
        correlationId: classifiedEvent.correlationId,
        causationId: classifiedEvent.eventId,
      });
      await publishAndPersist(this.supabase, unsubEvent);
      eventsPublished.push("email.bounce_detected(unsubscribe)");
    }

    return { pipelineResult, eventsPublished };
  }

  /**
   * Process an inbound message reception (before classification).
   * Publishes email.inbound_received so LeadPM can trigger engagement transitions.
   *
   * Callers: check-inbox after saving message to DB
   */
  async processInboundReceived(opts: {
    messageId: string;
    userId: string;
    partnerId: string | null;
    contactId?: string;
    fromAddress: string;
    subject?: string;
    channel: "email" | "whatsapp" | "linkedin";
    matchedOutreachId?: string;
  }): Promise<void> {
    const event = createEvent("email.inbound_received", opts.userId,
      { type: "system", name: "EmailProcessManager/check-inbox" },
      {
        messageId: opts.messageId,
        partnerId: opts.partnerId,
        contactId: opts.contactId,
        fromAddress: opts.fromAddress,
        subject: opts.subject,
        channel: opts.channel,
        matchedOutreachId: opts.matchedOutreachId,
      },
    );
    await publishAndPersist(this.supabase, event);
  }

  // ── Helpers ──

  /**
   * Infer the action the system should suggest based on classification category.
   */
  private inferAction(category: ClassificationCategory): string | undefined {
    const actionMap: Partial<Record<ClassificationCategory, string>> = {
      interested: "reply_interested",
      meeting_request: "schedule_meeting",
      not_interested: "send_graceful_close",
      question: "reply_to_question",
      request_info: "reply_to_question",
      complaint: "handle_complaint",
      bounce: "suggest_alternative_channel",
      unsubscribe: "blacklist_and_stop",
      quote_request: "forward_to_operative",
      booking_request: "forward_to_operative",
    };
    return actionMap[category];
  }

  /**
   * Convert urgency string to number for pipeline compatibility.
   */
  private urgencyToNumber(urgency: string): number {
    const map: Record<string, number> = {
      critical: 10,
      high: 7,
      normal: 5,
      low: 2,
    };
    return map[urgency] ?? 5;
  }
}

// ═══════════════════════════════════════════════════════════
//  FACTORY — Create and register in one call
// ═══════════════════════════════════════════════════════════

/**
 * Create an EmailProcessManager and register it on the EventBus.
 *
 * Usage:
 *   const emailPM = initEmailProcessManager(supabase);
 *   await emailPM.processClassification({ ... });
 *   // PM handles all downstream events automatically
 */
export function initEmailProcessManager(supabase: SupabaseClient): EmailProcessManager {
  const pm = new EmailProcessManager(supabase);
  pm.register();
  return pm;
}

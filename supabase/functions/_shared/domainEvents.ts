/**
 * domainEvents.ts — Typed Domain Event infrastructure.
 *
 * ARCHITETTURA: Questo è il sistema nervoso del sistema WCA.
 * Ogni mutazione di stato viene pubblicata come DomainEvent tipizzato.
 * I Process Manager (Lead, Email, Outreach, Learning) sottoscrivono
 * e reagiscono. Nessun altro modulo muta stato direttamente.
 *
 * Pattern: Event Catalog + Typed Publish/Subscribe + Audit Trail
 *
 * REGOLA D'ORO: Se non è in questo file, non è un evento valido.
 */

// ═══════════════════════════════════════════════════════════
//  BASE TYPES
// ═══════════════════════════════════════════════════════════

export interface DomainEvent<T extends string = string, P = unknown> {
  /** Unique event type identifier */
  type: T;
  /** ISO timestamp */
  timestamp: string;
  /** UUID v4 — idempotency key */
  eventId: string;
  /** Correlation ID — groups related events in a saga */
  correlationId: string;
  /** Causation ID — which event caused this one */
  causationId?: string;
  /** User who triggered the chain */
  userId: string;
  /** Actor: who/what published this event */
  actor: EventActor;
  /** Domain-specific payload */
  payload: P;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface EventActor {
  type: "user" | "system" | "cron" | "ai_agent" | "trigger";
  name: string;
}

// ═══════════════════════════════════════════════════════════
//  LEAD DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════

export type LeadStatus =
  | "new"
  | "first_touch_sent"
  | "holding"
  | "engaged"
  | "qualified"
  | "negotiation"
  | "converted"
  | "archived"
  | "blacklisted";

/** Published when a lead's commercial status changes */
export type LeadStatusChanged = DomainEvent<
  "lead.status_changed",
  {
    partnerId: string;
    previousStatus: LeadStatus | null;
    newStatus: LeadStatus;
    trigger: string;
    /** Was this auto-applied or manual? */
    autoApplied: boolean;
  }
>;

/** Published when the first outbound message is sent to a new lead */
export type FirstTouchSent = DomainEvent<
  "lead.first_touch_sent",
  {
    partnerId: string;
    contactId?: string;
    channel: "email" | "linkedin" | "whatsapp";
    sequenceDay: number;
  }
>;

/** Published when an operative signal suggests qualification */
export type LeadQualificationSignal = DomainEvent<
  "lead.qualification_signal",
  {
    partnerId: string;
    signalType: "quote_request" | "booking_request" | "rate_inquiry" | "explicit_need";
    confidence: number;
    sourceMessageId?: string;
  }
>;

/** Published when conversion evidence is detected */
export type ConversionSignalDetected = DomainEvent<
  "lead.conversion_signal",
  {
    partnerId: string;
    evidenceType: "contract" | "order" | "payment" | "manual_confirmation";
    sourceMessageId?: string;
  }
>;

// ═══════════════════════════════════════════════════════════
//  EMAIL DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════

/** Published after an email is successfully sent */
export type EmailSent = DomainEvent<
  "email.sent",
  {
    partnerId: string | null;
    contactId?: string;
    contactEmail: string;
    subject: string;
    channel: "email";
    activityId?: string;
    outreachQueueId?: string;
    sequenceDay?: number;
    quality?: "fast" | "standard" | "premium";
    journalistVerdict?: string;
  }
>;

/** Published when an inbound email is received and matched */
export type InboundEmailReceived = DomainEvent<
  "email.inbound_received",
  {
    messageId: string;
    partnerId: string | null;
    contactId?: string;
    fromAddress: string;
    subject?: string;
    channel: "email" | "whatsapp" | "linkedin";
    /** Was this matched to an existing outreach? */
    matchedOutreachId?: string;
  }
>;

/** Published after classification AI runs on an inbound message */
export type EmailClassified = DomainEvent<
  "email.classified",
  {
    messageId: string;
    partnerId: string | null;
    category: string;
    confidence: number;
    urgency: string;
    sentiment: string;
    actionSuggested?: string;
  }
>;

/** Published when a bounce or unsubscribe is detected */
export type EmailBounceDetected = DomainEvent<
  "email.bounce_detected",
  {
    contactEmail: string;
    partnerId?: string;
    bounceType: "hard" | "soft" | "unsubscribe" | "complaint";
    rawReason?: string;
  }
>;

// ═══════════════════════════════════════════════════════════
//  OUTREACH DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════

/** Published when a new outreach action is queued */
export type OutreachScheduled = DomainEvent<
  "outreach.scheduled",
  {
    outreachQueueId: string;
    partnerId: string;
    contactEmail: string;
    channel: "email" | "linkedin" | "whatsapp";
    scheduledAt: string;
    missionId?: string;
  }
>;

/** Published when an outreach is executed (sent) */
export type OutreachExecuted = DomainEvent<
  "outreach.executed",
  {
    outreachQueueId: string;
    partnerId: string;
    channel: "email" | "linkedin" | "whatsapp";
    success: boolean;
    errorReason?: string;
  }
>;

/** Published when a reply is detected to an outreach */
export type OutreachReplied = DomainEvent<
  "outreach.replied",
  {
    outreachQueueId: string;
    partnerId: string;
    replyMessageId: string;
    channel: string;
  }
>;

/** Published when cadence engine blocks an action */
export type CadenceViolation = DomainEvent<
  "outreach.cadence_violation",
  {
    partnerId: string;
    channel: "email" | "linkedin" | "whatsapp";
    reasonCode: string;
    reason: string;
    nextAllowedDate?: string;
  }
>;

// ═══════════════════════════════════════════════════════════
//  AI/AUTOMATION DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════

/** Published when AI creates a pending action for approval */
export type PendingActionCreated = DomainEvent<
  "ai.pending_action_created",
  {
    actionId: string;
    actionType: string;
    partnerId?: string;
    autonomyLevel: string;
    reasoning: string;
  }
>;

/** Published when a pending action is approved */
export type PendingActionApproved = DomainEvent<
  "ai.pending_action_approved",
  {
    actionId: string;
    actionType: string;
    approvedBy: "user" | "auto";
  }
>;

/** Published when a pending action execution completes */
export type ActionExecuted = DomainEvent<
  "ai.action_executed",
  {
    actionId: string;
    actionType: string;
    success: boolean;
    error?: string;
  }
>;

// ═══════════════════════════════════════════════════════════
//  ENRICHMENT DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════

/** Published when partner quality score is recalculated */
export type QualityScoreUpdated = DomainEvent<
  "enrichment.quality_score_updated",
  {
    partnerId: string;
    previousScore?: number;
    newScore: number;
    dimensions: Record<string, number>;
  }
>;

/** Published when enrichment data is refreshed */
export type EnrichmentRefreshed = DomainEvent<
  "enrichment.refreshed",
  {
    partnerId: string;
    source: "deep_search" | "sherlock" | "manual" | "scout";
    fieldsUpdated: string[];
  }
>;

// ═══════════════════════════════════════════════════════════
//  LEARNING DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════

/** Published when a new improvement rule is suggested */
export type ImprovementSuggested = DomainEvent<
  "learning.improvement_suggested",
  {
    suggestionId: string;
    suggestionType: string;
    title: string;
    source: "ai_agent" | "user" | "system";
  }
>;

/** Published when an improvement is approved and applied */
export type ImprovementApplied = DomainEvent<
  "learning.improvement_applied",
  {
    suggestionId: string;
    affectedPrompts: string[];
  }
>;

// ═══════════════════════════════════════════════════════════
//  UNION TYPE — ALL DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════

export type WCADomainEvent =
  // Lead
  | LeadStatusChanged
  | FirstTouchSent
  | LeadQualificationSignal
  | ConversionSignalDetected
  // Email
  | EmailSent
  | InboundEmailReceived
  | EmailClassified
  | EmailBounceDetected
  // Outreach
  | OutreachScheduled
  | OutreachExecuted
  | OutreachReplied
  | CadenceViolation
  // AI
  | PendingActionCreated
  | PendingActionApproved
  | ActionExecuted
  // Enrichment
  | QualityScoreUpdated
  | EnrichmentRefreshed
  // Learning
  | ImprovementSuggested
  | ImprovementApplied;

/** Extract event type string literals */
export type WCAEventType = WCADomainEvent["type"];

// ═══════════════════════════════════════════════════════════
//  EVENT BUS — Publish / Subscribe
// ═══════════════════════════════════════════════════════════

type EventHandler<E extends WCADomainEvent = WCADomainEvent> = (event: E) => Promise<void>;

/**
 * In-process EventBus. Per il contesto Edge Functions (stateless, request-scoped),
 * questo bus vive per la durata della request. Gli handler registrati all'avvio
 * del Process Manager processano gli eventi pubblicati durante la stessa request.
 *
 * Per persistenza cross-request, gli eventi vengono scritti nella tabella
 * `domain_events` e processati dal cron (agent-autonomous-cycle).
 */
class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private eventLog: WCADomainEvent[] = [];

  /** Subscribe a handler to a specific event type */
  on<T extends WCAEventType>(
    eventType: T,
    handler: EventHandler<Extract<WCADomainEvent, { type: T }>>,
  ): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler as EventHandler);
    this.handlers.set(eventType, existing);
  }

  /** Publish an event — runs all subscribed handlers + logs */
  async publish<E extends WCADomainEvent>(event: E): Promise<void> {
    this.eventLog.push(event);
    const handlers = this.handlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] Handler error for ${event.type}:`, err);
      }
    }
  }

  /** Get all events published in this request (for audit/debug) */
  getLog(): ReadonlyArray<WCADomainEvent> {
    return this.eventLog;
  }

  /** Clear all handlers and log (for testing) */
  reset(): void {
    this.handlers.clear();
    this.eventLog = [];
  }
}

/** Singleton per request-scope */
export const eventBus = new EventBus();

// ═══════════════════════════════════════════════════════════
//  FACTORY — Create events with auto-generated fields
// ═══════════════════════════════════════════════════════════

export function createEvent<T extends WCAEventType>(
  type: T,
  userId: string,
  actor: EventActor,
  payload: Extract<WCADomainEvent, { type: T }>["payload"],
  opts?: {
    correlationId?: string;
    causationId?: string;
    metadata?: Record<string, unknown>;
  },
): Extract<WCADomainEvent, { type: T }> {
  return {
    type,
    timestamp: new Date().toISOString(),
    eventId: crypto.randomUUID(),
    correlationId: opts?.correlationId || crypto.randomUUID(),
    causationId: opts?.causationId,
    userId,
    actor,
    payload,
    metadata: opts?.metadata,
  } as Extract<WCADomainEvent, { type: T }>;
}

// ═══════════════════════════════════════════════════════════
//  PERSISTENCE — Write events to DB for cross-request replay
// ═══════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Persist a domain event to the `domain_events` table.
 * Fire-and-forget — never blocks the main flow.
 */
export async function persistEvent(
  supabase: SupabaseClient,
  event: WCADomainEvent,
): Promise<void> {
  try {
    await supabase.from("domain_events").insert({
      event_id: event.eventId,
      event_type: event.type,
      correlation_id: event.correlationId,
      causation_id: event.causationId || null,
      user_id: event.userId,
      actor_type: event.actor.type,
      actor_name: event.actor.name,
      payload: event.payload,
      metadata: event.metadata || null,
      created_at: event.timestamp,
    });
  } catch (err) {
    console.warn("[persistEvent] Failed to persist domain event:", err);
  }
}

/**
 * Publish + persist in one call (most common usage pattern).
 */
export async function publishAndPersist(
  supabase: SupabaseClient,
  event: WCADomainEvent,
): Promise<void> {
  await Promise.all([
    eventBus.publish(event),
    persistEvent(supabase, event),
  ]);
}

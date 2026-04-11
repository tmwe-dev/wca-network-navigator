/**
 * Domain Events — Vol. IV §6 Event Bus
 *
 * Ogni evento ha: type, payload, timestamp, source, correlationId.
 * Usati dall'event bus per orchestrare core ↔ io.
 */

// ── Base event ───────────────────────────────────────────────────────

export interface DomainEvent<TType extends string, TPayload> {
  readonly type: TType;
  readonly payload: TPayload;
  readonly timestamp: string;
  readonly source: string;
  readonly correlationId: string;
}

// ── Event factory ────────────────────────────────────────────────────

let correlationCounter = 0;

export function createEvent<TType extends string, TPayload>(
  type: TType,
  payload: TPayload,
  source: string,
  correlationId?: string,
): DomainEvent<TType, TPayload> {
  return Object.freeze({
    type,
    payload,
    timestamp: new Date().toISOString(),
    source,
    correlationId: correlationId ?? `evt_${Date.now()}_${++correlationCounter}`,
  });
}

// ── Partner events ───────────────────────────────────────────────────

export type PartnerCreateRequested = DomainEvent<"partner.create.requested", { readonly companyName: string; readonly countryCode: string }>;
export type PartnerCreated = DomainEvent<"partner.created", { readonly partnerId: string }>;
export type PartnerCreateFailed = DomainEvent<"partner.create.failed", { readonly reason: string }>;
export type PartnerUpdated = DomainEvent<"partner.updated", { readonly partnerId: string; readonly fields: ReadonlyArray<string> }>;
export type PartnerDeleted = DomainEvent<"partner.deleted", { readonly partnerId: string }>;

// ── Contact events ───────────────────────────────────────────────────

export type ContactCreated = DomainEvent<"contact.created", { readonly contactId: string }>;
export type ContactUpdated = DomainEvent<"contact.updated", { readonly contactId: string }>;
export type ContactMatched = DomainEvent<"contact.matched", { readonly contactId: string; readonly partnerId: string; readonly confidence: number }>;

// ── Activity events ──────────────────────────────────────────────────

export type ActivityCreated = DomainEvent<"activity.created", { readonly activityId: string }>;
export type ActivityCompleted = DomainEvent<"activity.completed", { readonly activityId: string }>;

// ── Email events ─────────────────────────────────────────────────────

export type EmailSent = DomainEvent<"email.sent", { readonly messageId: string; readonly recipientEmail: string }>;
export type EmailFailed = DomainEvent<"email.failed", { readonly messageId: string; readonly reason: string }>;

// ── Agent events ─────────────────────────────────────────────────────

export type AgentTaskStarted = DomainEvent<"agent.task.started", { readonly taskId: string; readonly agentId: string }>;
export type AgentTaskCompleted = DomainEvent<"agent.task.completed", { readonly taskId: string; readonly summary: string }>;
export type AgentTaskFailed = DomainEvent<"agent.task.failed", { readonly taskId: string; readonly reason: string }>;

// ── Campaign events ──────────────────────────────────────────────────

export type CampaignStarted = DomainEvent<"campaign.started", { readonly campaignId: string }>;
export type CampaignPaused = DomainEvent<"campaign.paused", { readonly campaignId: string }>;
export type CampaignCompleted = DomainEvent<"campaign.completed", { readonly campaignId: string; readonly sentCount: number }>;

// ── Download events ──────────────────────────────────────────────────

export type DownloadStarted = DomainEvent<"download.started", { readonly jobId: string; readonly countryCode: string }>;
export type DownloadCompleted = DomainEvent<"download.completed", { readonly jobId: string; readonly totalFound: number }>;

// ── Health events ────────────────────────────────────────────────────

export type HealthCheckCompleted = DomainEvent<"health.check.completed", { readonly healthy: boolean; readonly services: Record<string, boolean> }>;

// ── Union of all events ──────────────────────────────────────────────

export type AppEvent =
  | PartnerCreateRequested | PartnerCreated | PartnerCreateFailed | PartnerUpdated | PartnerDeleted
  | ContactCreated | ContactUpdated | ContactMatched
  | ActivityCreated | ActivityCompleted
  | EmailSent | EmailFailed
  | AgentTaskStarted | AgentTaskCompleted | AgentTaskFailed
  | CampaignStarted | CampaignPaused | CampaignCompleted
  | DownloadStarted | DownloadCompleted
  | HealthCheckCompleted;

export type AppEventType = AppEvent["type"];

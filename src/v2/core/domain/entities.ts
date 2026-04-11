/**
 * Domain Entities — Vol. III §1 SSOT + Perfection Matrix
 *
 * Tipi brandizzati per tutte le entità principali.
 * Derivati dalle 72 tabelle DB ma come tipi di dominio strict.
 * Zero `any`. Tutte le proprietà readonly.
 */

// ── Branded ID types ─────────────────────────────────────────────────

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type PartnerId = Brand<string, "PartnerId">;
export type ContactId = Brand<string, "ContactId">;
export type AgentId = Brand<string, "AgentId">;
export type ActivityId = Brand<string, "ActivityId">;
export type CampaignId = Brand<string, "CampaignId">;
export type CampaignJobId = Brand<string, "CampaignJobId">;
export type KbEntryId = Brand<string, "KbEntryId">;
export type DownloadJobId = Brand<string, "DownloadJobId">;
export type UserId = Brand<string, "UserId">;
export type ImportLogId = Brand<string, "ImportLogId">;
export type MessageId = Brand<string, "MessageId">;

// ── ID constructors (runtime casting) ────────────────────────────────

export function partnerId(raw: string): PartnerId { return raw as PartnerId; }
export function contactId(raw: string): ContactId { return raw as ContactId; }
export function agentId(raw: string): AgentId { return raw as AgentId; }
export function activityId(raw: string): ActivityId { return raw as ActivityId; }
export function campaignId(raw: string): CampaignId { return raw as CampaignId; }
export function campaignJobId(raw: string): CampaignJobId { return raw as CampaignJobId; }
export function kbEntryId(raw: string): KbEntryId { return raw as KbEntryId; }
export function downloadJobId(raw: string): DownloadJobId { return raw as DownloadJobId; }
export function userId(raw: string): UserId { return raw as UserId; }
export function importLogId(raw: string): ImportLogId { return raw as ImportLogId; }
export function messageId(raw: string): MessageId { return raw as MessageId; }

// ── Activity enums ───────────────────────────────────────────────────

export type ActivityType =
  | "send_email" | "phone_call" | "add_to_campaign" | "meeting"
  | "follow_up" | "other" | "whatsapp_message" | "linkedin_message";

export type ActivityStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type CampaignJobType = "email" | "call";
export type CampaignJobStatus = "pending" | "in_progress" | "completed" | "skipped";

// ── Partner ──────────────────────────────────────────────────────────

export interface Partner {
  readonly id: PartnerId;
  readonly companyName: string;
  readonly wcaId: number | null;
  readonly countryCode: string;
  readonly countryName: string;
  readonly city: string | null;
  readonly address: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly networkName: string;
  readonly memberSince: string | null;
  readonly isBlacklisted: boolean;
  readonly enrichmentData: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly userId: UserId | null;
}

// ── Contact ──────────────────────────────────────────────────────────

export interface Contact {
  readonly id: ContactId;
  readonly importLogId: ImportLogId;
  readonly name: string | null;
  readonly companyName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobile: string | null;
  readonly position: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly origin: string | null;
  readonly leadStatus: string;
  readonly isSelected: boolean;
  readonly isTransferred: boolean;
  readonly wcaPartnerId: PartnerId | null;
  readonly wcaMatchConfidence: number | null;
  readonly rowNumber: number;
  readonly interactionCount: number;
  readonly lastInteractionAt: string | null;
  readonly createdAt: string;
  readonly userId: UserId | null;
}

// ── Agent ────────────────────────────────────────────────────────────

export interface Agent {
  readonly id: AgentId;
  readonly userId: UserId;
  readonly name: string;
  readonly role: string;
  readonly avatarEmoji: string;
  readonly systemPrompt: string;
  readonly isActive: boolean;
  readonly territoryCodes: ReadonlyArray<string>;
  readonly assignedTools: ReadonlyArray<unknown>;
  readonly knowledgeBase: ReadonlyArray<unknown>;
  readonly stats: Readonly<Record<string, unknown>>;
  readonly scheduleConfig: Readonly<Record<string, unknown>>;
  readonly signatureHtml: string | null;
  readonly signatureImageUrl: string | null;
  readonly elevenlabsVoiceId: string | null;
  readonly elevenlabsAgentId: string | null;
  readonly voiceCallUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── Activity ─────────────────────────────────────────────────────────

export interface Activity {
  readonly id: ActivityId;
  readonly partnerId: PartnerId | null;
  readonly assignedTo: string | null;
  readonly activityType: ActivityType;
  readonly title: string;
  readonly description: string | null;
  readonly status: ActivityStatus;
  readonly priority: string;
  readonly dueDate: string | null;
  readonly completedAt: string | null;
  readonly scheduledAt: string | null;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceMeta: Readonly<Record<string, unknown>> | null;
  readonly emailSubject: string | null;
  readonly emailBody: string | null;
  readonly reviewed: boolean;
  readonly sentAt: string | null;
  readonly userId: UserId | null;
  readonly executedByAgentId: AgentId | null;
  readonly createdAt: string;
}

// ── Campaign Job ─────────────────────────────────────────────────────

export interface CampaignJob {
  readonly id: CampaignJobId;
  readonly batchId: CampaignId;
  readonly partnerId: PartnerId;
  readonly companyName: string;
  readonly countryCode: string;
  readonly countryName: string;
  readonly jobType: CampaignJobType;
  readonly status: CampaignJobStatus;
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly notes: string | null;
  readonly assignedTo: string | null;
  readonly completedAt: string | null;
  readonly userId: UserId | null;
  readonly createdAt: string;
}

// ── Download Job ─────────────────────────────────────────────────────

export interface DownloadJob {
  readonly id: DownloadJobId;
  readonly countryCode: string;
  readonly countryName: string;
  readonly networkName: string;
  readonly jobType: string;
  readonly status: string;
  readonly totalCount: number;
  readonly currentIndex: number;
  readonly contactsFoundCount: number;
  readonly contactsMissingCount: number;
  readonly delaySeconds: number;
  readonly errorMessage: string | null;
  readonly userId: UserId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

// ── KbEntry (placeholder — tabella kb_entries non mostrata in schema) ─

export interface KbEntry {
  readonly id: KbEntryId;
  readonly title: string;
  readonly content: string;
  readonly tags: ReadonlyArray<string>;
  readonly userId: UserId;
  readonly createdAt: string;
}

// ── AiMemory ─────────────────────────────────────────────────────────

export interface AiMemory {
  readonly id: string;
  readonly userId: UserId;
  readonly content: string;
  readonly memoryType: string;
  readonly importance: number;
  readonly confidence: number;
  readonly level: number;
  readonly accessCount: number;
  readonly decayRate: number;
  readonly tags: ReadonlyArray<string>;
  readonly source: string;
  readonly contextPage: string | null;
  readonly pendingPromotion: boolean;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly lastAccessedAt: string | null;
  readonly promotedAt: string | null;
}

// ── EmailTemplate ────────────────────────────────────────────────────

export interface EmailTemplate {
  readonly id: string;
  readonly name: string;
  readonly fileName: string;
  readonly fileUrl: string;
  readonly fileSize: number;
  readonly fileType: string;
  readonly category: string | null;
  readonly userId: UserId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── Additional branded IDs ──────────────────────────────────────────

export type BusinessCardId = Brand<string, "BusinessCardId">;
export type SortingRuleId = Brand<string, "SortingRuleId">;
export type OperatorId = Brand<string, "OperatorId">;
export type WorkspaceDocId = Brand<string, "WorkspaceDocId">;
export type CreditTransactionId = Brand<string, "CreditTransactionId">;
export type OutreachQueueId = Brand<string, "OutreachQueueId">;
export type ProspectId = Brand<string, "ProspectId">;

export function businessCardId(raw: string): BusinessCardId { return raw as BusinessCardId; }
export function sortingRuleId(raw: string): SortingRuleId { return raw as SortingRuleId; }
export function operatorId(raw: string): OperatorId { return raw as OperatorId; }
export function workspaceDocId(raw: string): WorkspaceDocId { return raw as WorkspaceDocId; }
export function creditTransactionId(raw: string): CreditTransactionId { return raw as CreditTransactionId; }
export function outreachQueueId(raw: string): OutreachQueueId { return raw as OutreachQueueId; }
export function prospectId(raw: string): ProspectId { return raw as ProspectId; }

// ── BusinessCard ────────────────────────────────────────────────────

export interface BusinessCard {
  readonly id: BusinessCardId;
  readonly userId: UserId;
  readonly companyName: string | null;
  readonly contactName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobile: string | null;
  readonly position: string | null;
  readonly location: string | null;
  readonly eventName: string | null;
  readonly metAt: string | null;
  readonly photoUrl: string | null;
  readonly notes: string | null;
  readonly tags: ReadonlyArray<string>;
  readonly leadStatus: string;
  readonly matchStatus: string;
  readonly matchConfidence: number | null;
  readonly matchedPartnerId: PartnerId | null;
  readonly matchedContactId: ContactId | null;
  readonly createdAt: string;
}

// ── SortingRule ──────────────────────────────────────────────────────

export interface SortingRule {
  readonly id: SortingRuleId;
  readonly userId: UserId;
  readonly name: string;
  readonly field: string;
  readonly direction: string;
  readonly priority: number;
  readonly isActive: boolean;
  readonly createdAt: string;
}

// ── Operator ────────────────────────────────────────────────────────

export interface Operator {
  readonly id: OperatorId;
  readonly userId: UserId;
  readonly name: string;
  readonly email: string;
  readonly isAdmin: boolean;
  readonly isActive: boolean;
  readonly createdAt: string;
}

// ── WorkspaceDoc ────────────────────────────────────────────────────

export interface WorkspaceDoc {
  readonly id: WorkspaceDocId;
  readonly userId: UserId;
  readonly title: string;
  readonly content: string | null;
  readonly category: string | null;
  readonly createdAt: string;
}

// ── CreditTransaction ──────────────────────────────────────────────

export interface CreditTransaction {
  readonly id: CreditTransactionId;
  readonly userId: UserId;
  readonly amount: number;
  readonly operation: string;
  readonly description: string | null;
  readonly createdAt: string;
}

// ── ChannelMessage ──────────────────────────────────────────────────

export interface ChannelMessage {
  readonly id: MessageId;
  readonly userId: UserId;
  readonly channel: string;
  readonly direction: string;
  readonly subject: string | null;
  readonly fromAddress: string | null;
  readonly toAddress: string | null;
  readonly bodyText: string | null;
  readonly bodyHtml: string | null;
  readonly partnerId: PartnerId | null;
  readonly category: string | null;
  readonly readAt: string | null;
  readonly emailDate: string | null;
  readonly createdAt: string;
}

// ── OutreachQueueItem ───────────────────────────────────────────────

export interface OutreachQueueItem {
  readonly id: OutreachQueueId;
  readonly userId: UserId | null;
  readonly partnerId: string;
  readonly recipientEmail: string;
  readonly recipientName: string | null;
  readonly subject: string;
  readonly htmlBody: string;
  readonly status: string;
  readonly position: number;
  readonly scheduledAt: string | null;
  readonly sentAt: string | null;
  readonly errorMessage: string | null;
  readonly retryCount: number;
  readonly createdAt: string;
}

// ── Prospect ────────────────────────────────────────────────────────

export interface Prospect {
  readonly id: ProspectId;
  readonly companyName: string;
  readonly atecoCode: string | null;
  readonly region: string | null;
  readonly province: string | null;
  readonly city: string | null;
  readonly address: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly revenue: number | null;
  readonly employees: number | null;
  readonly status: string;
  readonly createdAt: string;
}

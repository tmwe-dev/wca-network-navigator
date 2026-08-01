/**
 * Tipi e helper puri estratti da LinkedInTest per snellire il componente.
 */
export const LI_COOLDOWN_MS = 800;
export const LI_DIAGNOSTIC_COOLDOWN_MS = 300;
export const LI_FIXED_RECIPIENT_KEY = "li_test_fixed_recipient";

export interface StoredLiTestRecipient {
  url?: string;
  savedAt?: string;
}

export interface FoundThread {
  name: string;
  threadUrl?: string;
}

export interface SyncQualitySummary {
  newMessages: number;
  rawCandidates: number;
  threadsAccepted: number;
  threadsDropped: Record<string, number>;
  messagesAccepted: number;
  messagesDropped: Record<string, number>;
  methods: Record<string, number>;
  avgConfidence: number;
  warnings: string[];
  at: number;
}

export function isValidLinkedInTestUrl(raw: string): boolean {
  return /^https:\/\/(www\.)?linkedin\.com\/(in|messaging\/thread)\//i.test(raw.trim());
}
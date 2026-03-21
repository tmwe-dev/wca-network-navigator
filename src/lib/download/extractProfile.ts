/**
 * V3: Simplified profile extraction — thin wrapper over extension response.
 * The extension now returns a structured result directly.
 * This module just normalizes edge cases.
 */

export interface ExtractionResult {
  success: boolean;
  wcaId?: number;
  state: "ok" | "member_not_found" | "not_loaded" | "bridge_error" | "extraction_error";
  companyName: string | null;
  contacts: Array<{ name?: string; title?: string; email?: string; phone?: string; mobile?: string }>;
  profile: Record<string, any>;
  profileHtml: string | null;
  htmlLength: number;
  error?: string | null;
}

export function normalizeExtensionResult(raw: any): ExtractionResult {
  if (!raw) return { success: false, state: "bridge_error", companyName: null, contacts: [], profile: {}, profileHtml: null, htmlLength: 0, error: "No response" };
  return {
    success: raw.success ?? false,
    wcaId: raw.wcaId,
    state: raw.state || (raw.success ? "ok" : "not_loaded"),
    companyName: raw.companyName || null,
    contacts: raw.contacts || [],
    profile: raw.profile || {},
    profileHtml: raw.profileHtml || null,
    htmlLength: raw.htmlLength || raw.profileHtml?.length || 0,
    error: raw.error || null,
  };
}

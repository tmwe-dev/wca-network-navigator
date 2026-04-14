/**
 * V4: Type definitions for extraction results.
 * The actual extraction is done by useExtensionBridge.
 */

export interface ExtractionResult {
  success: boolean;
  wcaId?: number;
  state: "ok" | "member_not_found" | "not_loaded" | "login_required" | "extraction_error" | "bridge_error";
  errorCode?: string | null;
  companyName: string | null;
  contacts: Array<{ name?: string; title?: string; email?: string; phone?: string; mobile?: string }>;
  profile: Record<string, any>;
  profileHtml: string | null;
  htmlLength: number;
  error?: string | null;
  debug?: Record<string, any>;
}

export function normalizeExtensionResult(raw: unknown): ExtractionResult {
  if (!raw) return { success: false, state: "bridge_error", errorCode: "EXT_BRIDGE_ERROR", companyName: null, contacts: [], profile: {}, profileHtml: null, htmlLength: 0, error: "No response" };
  return {
    success: raw.success ?? false,
    wcaId: raw.wcaId,
    state: raw.state || (raw.success ? "ok" : "not_loaded"),
    errorCode: raw.errorCode || null,
    companyName: raw.companyName || null,
    contacts: raw.contacts || [],
    profile: raw.profile || {},
    profileHtml: raw.profileHtml || null,
    htmlLength: raw.htmlLength || raw.profileHtml?.length || 0,
    error: raw.error || null,
    debug: raw.debug || {},
  };
}

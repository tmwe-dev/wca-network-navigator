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
  profile: Record<string, unknown>;
  profileHtml: string | null;
  htmlLength: number;
  error?: string | null;
  debug?: Record<string, unknown>;
}

export function normalizeExtensionResult(raw: unknown): ExtractionResult {
  if (!raw) return { success: false, state: "bridge_error", errorCode: "EXT_BRIDGE_ERROR", companyName: null, contacts: [], profile: {}, profileHtml: null, htmlLength: 0, error: "No response" };
  const r = raw as Record<string, unknown>;
  return {
    success: (r.success as boolean) ?? false,
    wcaId: r.wcaId as number | undefined,
    state: (r.state as ExtractionResult["state"]) || (r.success ? "ok" : "not_loaded"),
    errorCode: (r.errorCode as string) || null,
    companyName: (r.companyName as string) || null,
    contacts: (r.contacts as ExtractionResult["contacts"]) || [],
    profile: (r.profile as Record<string, unknown>) || {},
    profileHtml: (r.profileHtml as string) || null,
    htmlLength: (r.htmlLength as number) || (typeof r.profileHtml === "string" ? r.profileHtml.length : 0) || 0,
    error: (r.error as string) || null,
    debug: (r.debug as Record<string, unknown>) || {},
  };
}

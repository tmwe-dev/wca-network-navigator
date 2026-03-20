/**
 * Simplified profile extraction via Chrome extension bridge.
 * Single responsibility: call extension, handle timeout, return clean result.
 */

export interface ExtractionResult {
  success: boolean;
  companyName: string;
  contacts: Array<{ name?: string; title?: string; email?: string; phone?: string; mobile?: string }>;
  profile: Record<string, any>;
  profileHtml: string | null;
  pageLoaded: boolean;
  memberNotFound: boolean;
  htmlLength: number;
  error?: string;
}

export async function extractProfile(
  wcaId: number,
  extractContacts: (id: number) => Promise<any>,
): Promise<ExtractionResult> {
  const empty: ExtractionResult = {
    success: false, companyName: "", contacts: [], profile: {},
    profileHtml: null, pageLoaded: false, memberNotFound: false, htmlLength: 0,
  };

  if (typeof extractContacts !== "function") {
    return { ...empty, error: "bridge_missing" };
  }

  try {
    const result = await extractContacts(wcaId);

    // Timeout / stale
    if (result.error === "Timeout" || result.error?.includes("Stale response")) {
      return { ...empty, error: "timeout" };
    }

    // Page not loaded
    if (result.pageLoaded === false) {
      return { ...empty, error: "not_loaded" };
    }

    // Member not found
    const isMemberNotFound =
      result.companyName?.toLowerCase().includes("member not found") ||
      result.error?.toLowerCase().includes("member not found");
    if (isMemberNotFound) {
      return { ...empty, memberNotFound: true, htmlLength: result.htmlLength || result.profileHtml?.length || 0 };
    }

    // Extension error but page loaded
    if (result.success === false) {
      return { ...empty, error: result.error || "extension_error" };
    }

    // Success
    return {
      success: true,
      companyName: result.companyName || "",
      contacts: result.contacts || [],
      profile: result.profile || {},
      profileHtml: result.profileHtml || null,
      pageLoaded: true,
      memberNotFound: false,
      htmlLength: result.profileHtml?.length || 0,
    };
  } catch (err) {
    return { ...empty, error: (err as Error).message };
  }
}

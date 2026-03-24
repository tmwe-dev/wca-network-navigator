/**
 * @deprecated Usare @/lib/wca-app-bridge al suo posto.
 * Questo file reindirizza per compatibilità.
 * 🤖 Claude Engine — Diario di bordo #4
 */
export {
  wcaLogin as wcaAppLogin,
  wcaDiscover as wcaAppDiscover,
  wcaDiscoverAll as wcaAppDiscoverAll,
  wcaScrape as wcaAppScrape,
  wcaSave as wcaAppSave,
} from "@/lib/wca-app-bridge";

// Re-export types with old names
export type WcaAppLoginResult = { success: boolean; cookie?: string; error?: string };
export type WcaAppDiscoverMember = { id: number; name: string; city?: string; country?: string };
export type WcaAppDiscoverResult = { success: boolean; members: WcaAppDiscoverMember[]; totalPages: number; currentPage: number; error?: string };
export type WcaAppScrapeResult = { success: boolean; found?: boolean; partner?: Record<string, any>; error?: string };
export type WcaAppSaveResult = { success: boolean; action?: "inserted" | "updated"; error?: string };

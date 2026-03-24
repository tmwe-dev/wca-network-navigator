/**
 * WCA App Bridge — Client per le API Vercel di wca-app.
 *
 * Fornisce accesso diretto alle API del scraper Vercel come source
 * alternativa o fallback quando l'estensione Chrome non è disponibile.
 *
 * Endpoints:
 *   POST /api/login    → { cookie }
 *   POST /api/discover → { members[], totalPages }
 *   POST /api/scrape   → { partner data }
 *   POST /api/save     → { success }
 *
 * Non modifica nessun file esistente di Lovable.
 */

const WCA_APP_BASE = "https://wca-app.vercel.app/api";

// ── Types ──

export interface WcaAppLoginResult {
  success: boolean;
  cookie?: string;
  error?: string;
}

export interface WcaAppDiscoverMember {
  id: number;
  name: string;
  city?: string;
  country?: string;
}

export interface WcaAppDiscoverResult {
  success: boolean;
  members: WcaAppDiscoverMember[];
  totalPages: number;
  currentPage: number;
  error?: string;
}

export interface WcaAppScrapeResult {
  success: boolean;
  found?: boolean;
  partner?: Record<string, any>;
  error?: string;
}

export interface WcaAppSaveResult {
  success: boolean;
  action?: "inserted" | "updated";
  error?: string;
}

// ── API Calls ──

export async function wcaAppLogin(
  username: string,
  password: string
): Promise<WcaAppLoginResult> {
  try {
    const res = await fetch(`${WCA_APP_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || `HTTP ${res.status}` };
    return { success: true, cookie: data.cookie };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function wcaAppDiscover(
  country: string,
  page: number,
  cookie: string
): Promise<WcaAppDiscoverResult> {
  try {
    const res = await fetch(`${WCA_APP_BASE}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, page, cookie }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, members: [], totalPages: 0, currentPage: page, error: data.error || `HTTP ${res.status}` };
    return {
      success: true,
      members: data.members || [],
      totalPages: data.totalPages || 1,
      currentPage: page,
    };
  } catch (err) {
    return { success: false, members: [], totalPages: 0, currentPage: page, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function wcaAppScrape(
  memberId: number,
  cookie: string
): Promise<WcaAppScrapeResult> {
  try {
    const res = await fetch(`${WCA_APP_BASE}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, cookie }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || `HTTP ${res.status}` };
    return { success: true, found: data.found !== false, partner: data.partner || data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function wcaAppSave(
  partner: Record<string, any>
): Promise<WcaAppSaveResult> {
  try {
    const res = await fetch(`${WCA_APP_BASE}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || `HTTP ${res.status}` };
    return { success: true, action: data.action };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Discover completo: scarica tutte le pagine di un paese.
 * Ritorna l'array completo di membri con progress callback.
 */
export async function wcaAppDiscoverAll(
  country: string,
  cookie: string,
  onProgress?: (page: number, totalPages: number, membersFound: number) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; members: WcaAppDiscoverMember[]; error?: string }> {
  const allMembers: WcaAppDiscoverMember[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    if (signal?.aborted) return { success: false, members: allMembers, error: "Aborted" };

    const result = await wcaAppDiscover(country, page, cookie);
    if (!result.success) return { success: false, members: allMembers, error: result.error };

    allMembers.push(...result.members);
    totalPages = result.totalPages;
    onProgress?.(page, totalPages, allMembers.length);

    page++;
    if (page <= totalPages) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { success: true, members: allMembers };
}

/**
 * WCA App Bridge — Client per le API Vercel di wca-app
 * 🤖 Creato da Claude · Diario di bordo #1
 * 
 * Collega il sistema Lovable alle API indipendenti su wca-app.vercel.app
 * Usato come engine di download alternativo/primario per lo scraping WCA.
 */

const WCA_APP_BASE = "https://wca-app.vercel.app/api";

export interface WcaMember {
  id: number;
  name: string;
  company?: string;
  country?: string;
}

export interface DiscoverResult {
  members: WcaMember[];
  totalPages: number;
  page: number;
}

export interface ScrapeResult {
  success: boolean;
  found?: boolean;
  partner?: Record<string, any>;
  error?: string;
}

/** Login WCA via SSO — restituisce il cookie di sessione */
export async function wcaLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${WCA_APP_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!data.cookie) throw new Error(data.error || "Login fallito");
  return data.cookie;
}

/** Discover membri per paese (una pagina alla volta) */
export async function wcaDiscover(
  country: string,
  page: number,
  cookie: string
): Promise<DiscoverResult> {
  const res = await fetch(`${WCA_APP_BASE}/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country, page, cookie }),
  });
  if (!res.ok) throw new Error(`Discover failed: ${res.status}`);
  return res.json();
}

/** Discover TUTTI i membri di un paese (tutte le pagine) */
export async function wcaDiscoverAll(
  country: string,
  cookie: string,
  onProgress?: (page: number, total: number) => void
): Promise<WcaMember[]> {
  const all: WcaMember[] = [];
  let page = 1;
  let totalPages = 1;
  
  do {
    const result = await wcaDiscover(country, page, cookie);
    all.push(...result.members);
    totalPages = result.totalPages;
    onProgress?.(page, totalPages);
    page++;
  } while (page <= totalPages);
  
  return all;
}

/** Scrape profilo singolo */
export async function wcaScrape(
  memberId: number,
  cookie: string
): Promise<ScrapeResult> {
  const res = await fetch(`${WCA_APP_BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, cookie }),
  });
  if (!res.ok) throw new Error(`Scrape failed: ${res.status}`);
  return res.json();
}

/** Salva partner su Supabase via wca-app */
export async function wcaSave(partner: Record<string, any>): Promise<void> {
  const res = await fetch(`${WCA_APP_BASE}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner }),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}

/** Health check — verifica se wca-app è raggiungibile */
export async function wcaHealthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${WCA_APP_BASE}/login`, {
      method: "OPTIONS",
    });
    return res.ok || res.status === 405;
  } catch {
    return false;
  }
}

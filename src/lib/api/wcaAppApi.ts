/**
 * wcaAppApi — Client centralizzato per TUTTI gli endpoint wca-app.vercel.app
 * 🤖 Claude Engine V8 · Nessun bridge, chiamate dirette
 */

import { createLogger } from "@/lib/log";
import { ApiError } from "@/lib/api/apiError";
import { waitForGreenLight, markRequestSent } from "@/lib/wcaCheckpoint";
import {
  safeParseDiscover,
  safeParseScrape,
  safeParseCheckIds,
  safeParseJobStart,
} from "./wcaAppApi.schemas";

const log = createLogger("wcaAppApi");

const BASE = "https://wca-app.vercel.app/api";

/**
 * assertOk — Vol. II §5.3
 * Standardizza la conversione Response → ApiError quando lo status non
 * è ok. Tutti gli endpoint del modulo passano per qui invece di lanciare
 * `new Error("X failed: 4xx")`.
 */
async function assertOk(res: Response, context: string): Promise<void> {
  if (res.ok) return;
  throw await ApiError.fromResponse(res, context);
}

// ─── Cookie cache ───────────────────────────────────────────────
const COOKIE_KEY = "wca_session_cookie";
const COOKIE_TTL = 8 * 60 * 1000; // 8 min
const COOKIE_REFRESH_MARGIN = 60 * 1000; // refresh proactively if < 1 min remaining (P4.4)

async function getOrRefreshCookie(): Promise<string> {
  try {
    const cached = localStorage.getItem(COOKIE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.savedAt;
      if (parsed.cookie && age < COOKIE_TTL - COOKIE_REFRESH_MARGIN) {
        return parsed.cookie;
      }
    }
  } catch (err) {
    log.warn("cookie cache read failed", { message: err instanceof Error ? err.message : String(err) });
  }

  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await res.json();
  const cookie = data.cookies || data.cookie;
  if (!cookie) {
    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: data.error || "Login WCA fallito",
      details: { context: "wcaLogin" },
    });
  }
  try {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ cookie, savedAt: Date.now() }));
  } catch (err) {
    log.warn("cookie cache write failed", { message: err instanceof Error ? err.message : String(err) });
  }
  return cookie;
}

/**
 * P4.3 — Checkpoint gate per chiamate user-facing a wca-app.
 * Aspetta la green-zone (≥20s tra una richiesta e l'altra) prima di
 * eseguire fetch verso endpoint sensibili (discover/scrape/enrich/verify).
 * Background workers (job-start/job-status/worker) sono ESCLUSI: gestiscono
 * il rate limit lato server.
 */
async function gateAndMark(context: string): Promise<void> {
  const ok = await waitForGreenLight();
  if (!ok) {
    throw new ApiError({
      code: "RATE_LIMITED",
      message: "WCA checkpoint denied",
      details: { context },
    });
  }
  markRequestSent();
}

// ─── Types ──────────────────────────────────────────────────────

export interface WcaMember {
  id: number;
  name: string;
  href?: string;
  company?: string;
  networks?: string[];
}

export interface DiscoverResult {
  success: boolean;
  members: WcaMember[];
  page: number;
  hasNext: boolean;
  totalResults: number | null;
  isLoggedIn?: boolean;
  error?: string;
}

export interface ScrapeProfile {
  wca_id?: number;
  state?: string;
  company_name?: string;
  logo_url?: string | null;
  branch?: string;
  gm_coverage?: boolean | null;
  gm_status_text?: string;
  enrolled_offices?: string[];
  enrolled_since?: string;
  expires?: string;
  networks?: string[];
  profile_text?: string;
  address?: string;
  mailing?: string;
  phone?: string;
  fax?: string;
  emergency_call?: string;
  website?: string;
  email?: string;
  contacts?: Array<{ name?: string; title?: string; email?: string; direct_line?: string; fax?: string; mobile?: string; skype?: string }>;
  services?: string[];
  certifications?: string[];
  branch_cities?: string[];
  country_code?: string;
  [key: string]: unknown;
}

export interface ScrapeResult {
  success: boolean;
  results?: ScrapeProfile[];
  error?: string;
}

export interface SaveResult {
  success: boolean;
  wca_id?: number;
  error?: string;
}

export interface CheckIdsResult {
  success: boolean;
  total_in_db: number;
  checked: number;
  found: number;
  missing: number[];
  elapsed_ms: number;
  error?: string;
}

export interface JobStartResult {
  success: boolean;
  action?: "paused" | "resumed" | "cancelled";
  jobId?: string;
  status?: string;
  error?: string;
}

export interface WcaJob {
  id: string;
  status: string;
  countries: string[];
  currentCountry: string;
  currentCountryIdx: number;
  totalCountries: number;
  currentMemberIdx: number;
  totalMembers: number;
  totalScraped: number;
  totalSkipped: number;
  consecutiveFailures: number;
  lastActivity: string;
  recentLogs: Array<{ t: string; m: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface JobStatusResult {
  success: boolean;
  job: WcaJob | null;
  error?: string;
}

export interface WorkerResult {
  success: boolean;
  message?: string;
  phase?: string;
  members?: number;
  processed?: number;
  remaining?: number;
  total_scraped?: number;
  error?: string;
}

export interface EnrichResult {
  success: boolean;
  enriched: boolean;
  profile?: ScrapeProfile;
  searchedName?: string;
  foundName?: string;
  networkMemberId?: number;
  error?: string;
}

export interface VerifyResult {
  success: boolean;
  found: boolean;
  wcaId: number;
  network: string;
  domain?: string;
  profile?: ScrapeProfile;
  error?: string;
}

export interface PartnersResult {
  success: boolean;
  partners?: unknown[];
  total?: number;
  page?: number;
  error?: string;
}

export interface CountryCountsResult {
  success: boolean;
  counts?: Record<string, number>;
  error?: string;
}

// ─── API Functions ──────────────────────────────────────────────

/** Auto-login → restituisce cookie WCA */
export async function wcaLogin(): Promise<string> {
  return getOrRefreshCookie();
}

/** Discover membri per paese (singola pagina) */
export async function wcaDiscover(
  country: string,
  page = 1,
  options?: { cookie?: string; networks?: string[]; searchTerm?: string; searchBy?: string; city?: string }
): Promise<DiscoverResult> {
  const cookie = options?.cookie || (await getOrRefreshCookie());
  const filters: Record<string, unknown> = { country };
  if (options?.networks?.length) filters.networks = options.networks;
  if (options?.searchTerm) filters.searchTerm = options.searchTerm;
  if (options?.searchBy) filters.searchBy = options.searchBy;
  if (options?.city) filters.city = options.city;

  await gateAndMark("wcaDiscover");
  const res = await fetch(`${BASE}/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies: cookie, page, filters }),
  });
  await assertOk(res, "wcaDiscover");
  const json = await res.json();
  // Vol. II §5.3 — runtime schema check (best-effort, non-breaking)
  safeParseDiscover(json);
  return json;
}

/** Discover TUTTI i membri (tutte le pagine) */
export async function wcaDiscoverAll(
  country: string,
  onProgress?: (page: number, totalEstimate: number) => void
): Promise<WcaMember[]> {
  const cookie = await getOrRefreshCookie();
  const all: WcaMember[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const result = await wcaDiscover(country, page, { cookie });
    all.push(...(result.members || []));
    hasNext = result.hasNext ?? false;
    const totalPages = result.totalResults ? Math.ceil(result.totalResults / 50) : page;
    onProgress?.(page, totalPages);
    page++;
  }
  return all;
}

/** Scrape profili (SSO auto server-side, no cookie needed) */
export async function wcaScrape(wcaIds: number[], networkDomain?: string): Promise<ScrapeResult> {
  const body: Record<string, unknown> = { wcaIds };
  if (networkDomain) body.networkDomain = networkDomain;
  await gateAndMark("wcaScrape");
  const res = await fetch(`${BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await assertOk(res, "wcaScrape");
  const json = await res.json();
  safeParseScrape(json);
  return json;
}

/** Salva profilo su Supabase */
export async function wcaSave(profile: Record<string, unknown>): Promise<SaveResult> {
  const res = await fetch(`${BASE}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  await assertOk(res, "wcaSave");
  return res.json();
}

/** Confronta IDs con DB — restituisce quelli mancanti */
export async function wcaCheckIds(ids: number[], country?: string): Promise<CheckIdsResult> {
  const res = await fetch(`${BASE}/check-ids`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, country }),
  });
  await assertOk(res, "wcaCheckIds");
  const json = await res.json();
  safeParseCheckIds(json);
  return json;
}

// ─── Job System (server-side worker) ────────────────────────────

/** Avvia job download server-side */
export async function wcaJobStart(
  countries: Array<{ code: string; name: string }>,
  options?: { networks?: string[]; searchTerm?: string; searchBy?: string }
): Promise<JobStartResult> {
  const res = await fetch(`${BASE}/job-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      countries,
      networks: options?.networks,
      searchTerm: options?.searchTerm,
      searchBy: options?.searchBy,
    }),
  });
  await assertOk(res, "wcaJobStart");
  const json = await res.json();
  safeParseJobStart(json);
  return json;
}

/** Pausa job */
export async function wcaJobPause(jobId: string): Promise<JobStartResult> {
  const res = await fetch(`${BASE}/job-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pause", jobId }),
  });
  await assertOk(res, "wcaJobPause");
  return res.json();
}

/** Riprendi job */
export async function wcaJobResume(jobId: string): Promise<JobStartResult> {
  const res = await fetch(`${BASE}/job-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "resume", jobId }),
  });
  await assertOk(res, "wcaJobResume");
  return res.json();
}

/** Cancella job */
export async function wcaJobCancel(jobId: string): Promise<JobStartResult> {
  const res = await fetch(`${BASE}/job-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel", jobId }),
  });
  await assertOk(res, "wcaJobCancel");
  return res.json();
}

/** Status job (ultimo se jobId omesso) */
export async function wcaJobStatus(jobId?: string): Promise<JobStatusResult> {
  const url = jobId ? `${BASE}/job-status?jobId=${jobId}` : `${BASE}/job-status`;
  const res = await fetch(url);
  await assertOk(res, "wcaJobStatus");
  return res.json();
}

/** Trigger manuale worker */
export async function wcaWorkerTrigger(jobId?: string): Promise<WorkerResult> {
  const url = jobId ? `${BASE}/worker?jobId=${jobId}` : `${BASE}/worker`;
  const res = await fetch(url);
  await assertOk(res, "wcaWorkerTrigger");
  return res.json();
}

// ─── Enrich & Verify ────────────────────────────────────────────

/** Enrichment cross-network */
export async function wcaEnrich(
  companyName: string,
  networkDomain: string,
  options?: { originalWcaId?: number; networkName?: string }
): Promise<EnrichResult> {
  await gateAndMark("wcaEnrich");
  const res = await fetch(`${BASE}/enrich`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName,
      networkDomain,
      originalWcaId: options?.originalWcaId,
      networkName: options?.networkName,
    }),
  });
  await assertOk(res, "wcaEnrich");
  return res.json();
}

/** Verifica membro su network specifico */
export async function wcaVerify(wcaId: number, network: string): Promise<VerifyResult> {
  await gateAndMark("wcaVerify");
  const res = await fetch(`${BASE}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wcaId, network }),
  });
  await assertOk(res, "wcaVerify");
  return res.json();
}

// ─── Partners DB Query ──────────────────────────────────────────

/** Query partners dal DB */
export async function wcaPartners(options?: {
  country?: string;
  search?: string;
  page?: number;
  limit?: number;
  select?: string;
}): Promise<PartnersResult> {
  const params = new URLSearchParams();
  if (options?.country) params.set("country", options.country);
  if (options?.search) params.set("search", options.search);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.select) params.set("select", options.select);

  const res = await fetch(`${BASE}/partners?${params}`);
  await assertOk(res, "wcaPartners");
  return res.json();
}

/** Conta partners per paese */
export async function wcaCountryCounts(): Promise<CountryCountsResult> {
  const res = await fetch(`${BASE}/partners?action=country_counts`);
  await assertOk(res, "wcaCountryCounts");
  return res.json();
}

// ─── Network Domain Map ─────────────────────────────────────────

export const WCA_NETWORKS: Record<string, { id: number; domain?: string }> = {
  "WCA First": { id: 1, domain: "www.wcaworld.com" },
  "WCA Advanced Professionals": { id: 2, domain: "www.wcaworld.com" },
  "WCA China Global": { id: 3, domain: "www.wcaworld.com" },
  "WCA Inter Global": { id: 4, domain: "interglobal.wcaworld.com" },
  "Lognet Global": { id: 61, domain: "lognetglobal.com" },
  "Global Affinity Alliance": { id: 98, domain: "globalaffinityalliance.com" },
  "Elite Global Logistics Network": { id: 108, domain: "elitegln.com" },
  "InFinite Connection (IFC8)": { id: 118, domain: "ifc8.wcaworld.com" },
  "WCA Projects": { id: 5, domain: "projects.wcaworld.com" },
  "WCA Dangerous Goods": { id: 22, domain: "dangerousgoods.wcaworld.com" },
  "WCA Perishables": { id: 13, domain: "perishables.wcaworld.com" },
  "WCA Time Critical": { id: 18, domain: "timecritical.wcaworld.com" },
  "WCA Relocations": { id: 15, domain: "relocations.wcaworld.com" },
  "WCA Pharma": { id: 16, domain: "pharma.wcaworld.com" },
  "WCA Vendors": { id: 38, domain: "vendors.wcaworld.com" },
  "WCA eCommerce Solutions": { id: 107, domain: "ecommerce.wcaworld.com" },
  "WCA Live Events and Expo": { id: 124, domain: "liveevents.wcaworld.com" },
};

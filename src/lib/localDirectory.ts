import { createLogger } from "@/lib/log";

const log = createLogger("localDirectory");
/**
 * Local Directory — Sistema di confronto locale zero-query
 * 🤖 Creato da Claude · Diario di bordo #1
 * 
 * Mantiene in localStorage lo stato di ogni ID per paese:
 * pending / done / failed. Permette ripresa istantanea senza query server.
 */

export type IdStatus = "pending" | "done" | "failed";

export interface Directory {
  countryCode: string;
  countryName: string;
  ids: Record<string, IdStatus>;
  /** Network domains per membro (es. { "12345": ["lognetglobal.com", "wca-first"] }) */
  memberNetworks?: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface SuspendedJob {
  countryCode: string;
  countryName: string;
  pendingCount: number;
  doneCount: number;
  totalCount: number;
  savedAt: string;
}

const DIR_PREFIX = "wca_dir_";
const JOBS_KEY = "wca_suspended_jobs";

// ── Directory CRUD ──

export function getDirectory(countryCode: string): Directory | null {
  const raw = localStorage.getItem(`${DIR_PREFIX}${countryCode}`);
  return raw ? JSON.parse(raw) : null;
}

export function saveDirectory(countryCode: string, dir: Directory): void {
  dir.updatedAt = new Date().toISOString();
  localStorage.setItem(`${DIR_PREFIX}${countryCode}`, JSON.stringify(dir));
}

export function createDirectory(
  countryCode: string,
  countryName: string,
  memberIds: number[],
  networkMap?: Record<number, string[]>
): Directory {
  const existing = getDirectory(countryCode);
  const ids: Record<string, IdStatus> = {};
  const memberNetworks: Record<string, string[]> = existing?.memberNetworks || {};

  for (const id of memberIds) {
    const key = String(id);
    // Preserva lo stato se già esiste (done/failed restano)
    ids[key] = existing?.ids[key] || "pending";
    // Salva networks dal discover (sovrascrive se nuovi dati)
    if (networkMap?.[id]?.length) {
      memberNetworks[key] = networkMap[id];
    }
  }

  const dir: Directory = {
    countryCode,
    countryName,
    ids,
    memberNetworks,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDirectory(countryCode, dir);
  return dir;
}

export function markIdDone(countryCode: string, id: number): void {
  const dir = getDirectory(countryCode);
  if (!dir) return;
  dir.ids[String(id)] = "done";
  saveDirectory(countryCode, dir);
}

export function markIdFailed(countryCode: string, id: number): void {
  const dir = getDirectory(countryCode);
  if (!dir) return;
  dir.ids[String(id)] = "failed";
  saveDirectory(countryCode, dir);
}

// ── Query helpers ──

export function getPendingIds(countryCode: string): number[] {
  const dir = getDirectory(countryCode);
  if (!dir) return [];
  return Object.entries(dir.ids)
    .filter(([, status]) => status === "pending")
    .map(([id]) => Number(id));
}

export function getDoneCount(countryCode: string): number {
  const dir = getDirectory(countryCode);
  if (!dir) return 0;
  return Object.values(dir.ids).filter((s) => s === "done").length;
}

export function getTotalCount(countryCode: string): number {
  const dir = getDirectory(countryCode);
  if (!dir) return 0;
  return Object.keys(dir.ids).length;
}

export function isCountryCompleted(countryCode: string): boolean {
  return getPendingIds(countryCode).length === 0 && getTotalCount(countryCode) > 0;
}

/** Confronto locale istantaneo — restituisce gli ID mancanti */
export function checkMissingIdsLocal(
  discoverIds: number[],
  countryCode: string
): { missing: number[]; found: number } {
  const dir = getDirectory(countryCode);
  if (!dir) return { missing: discoverIds, found: 0 };
  const missing = discoverIds.filter((id) => dir.ids[String(id)] !== "done");
  return { missing, found: discoverIds.length - missing.length };
}

// ── Suspended Jobs ──

export function getSuspendedJobs(): SuspendedJob[] {
  const raw = localStorage.getItem(JOBS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveSuspendedJob(countryCode: string, countryName: string): void {
  const dir = getDirectory(countryCode);
  if (!dir) return;

  const jobs = getSuspendedJobs().filter((j) => j.countryCode !== countryCode);
  const pending = getPendingIds(countryCode).length;
  const done = getDoneCount(countryCode);
  const total = getTotalCount(countryCode);

  if (pending > 0) {
    jobs.push({
      countryCode,
      countryName,
      pendingCount: pending,
      doneCount: done,
      totalCount: total,
      savedAt: new Date().toISOString(),
    });
  }

  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export function removeSuspendedJob(countryCode: string): void {
  const jobs = getSuspendedJobs().filter((j) => j.countryCode !== countryCode);
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

/** Recupera il primo network domain di un membro dalla directory locale */
export function getMemberNetworkDomain(countryCode: string, memberId: number): string | null {
  const dir = getDirectory(countryCode);
  if (!dir?.memberNetworks) return null;
  const nets = dir.memberNetworks[String(memberId)];
  if (!nets || nets.length === 0) return null;
  // Priorità: domini con sito proprio (non wca-first/wca-advanced che sono su wcaworld.com)
  const ownDomain = nets.find(n => !n.startsWith("wca-") && n !== "wcaworld.com");
  return ownDomain || nets[0];
}

/** Lista tutti i paesi con directory locale */
export function getAllDirectories(): Directory[] {
  const dirs: Directory[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DIR_PREFIX)) {
      try {
        dirs.push(JSON.parse(localStorage.getItem(key)!));
      } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
    }
  }
  return dirs;
}

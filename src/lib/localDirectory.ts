/**
 * Local Directory — Sistema directory locale per tracking ID per paese.
 *
 * Salva lo stato di ogni ID (pending/done/failed) in localStorage.
 * Permette confronto istantaneo senza query al server.
 * Portato dal sistema wca-app in TypeScript per Lovable.
 *
 * Storage keys:
 *   wca_dir_{CC}         → directory del paese (es. wca_dir_IT)
 *   wca_suspended_jobs   → lista job sospesi con stato
 *
 * Non modifica nessun file esistente di Lovable.
 */

export type IdStatus = "pending" | "done" | "failed";

export interface CountryDirectory {
  countryCode: string;
  countryName: string;
  ids: Record<string, IdStatus>;
  createdAt: string;
  updatedAt: string;
}

export interface SuspendedJob {
  countryCode: string;
  countryName: string;
  pendingIds: number[];
  allMemberCount: number;
  savedAt: string;
}

// ── Directory CRUD ──

export function getDirectory(countryCode: string): CountryDirectory | null {
  try {
    const raw = localStorage.getItem(`wca_dir_${countryCode}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDirectory(countryCode: string, dir: CountryDirectory): void {
  dir.updatedAt = new Date().toISOString();
  localStorage.setItem(`wca_dir_${countryCode}`, JSON.stringify(dir));
}

export function createDirectory(
  countryCode: string,
  countryName: string,
  memberIds: number[]
): CountryDirectory {
  const ids: Record<string, IdStatus> = {};
  for (const id of memberIds) {
    ids[String(id)] = "pending";
  }
  const dir: CountryDirectory = {
    countryCode,
    countryName,
    ids,
    createdAt: new Date().toISOString(),
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

export function getFailedCount(countryCode: string): number {
  const dir = getDirectory(countryCode);
  if (!dir) return 0;
  return Object.values(dir.ids).filter((s) => s === "failed").length;
}

export function getTotalCount(countryCode: string): number {
  const dir = getDirectory(countryCode);
  if (!dir) return 0;
  return Object.keys(dir.ids).length;
}

export function isCountryCompleted(countryCode: string): boolean {
  return getPendingIds(countryCode).length === 0 && getTotalCount(countryCode) > 0;
}

/**
 * Confronto locale istantaneo: filtra gli ID già "done" dalla lista discover.
 * Nessuna query al server.
 */
export function checkMissingIdsLocal(
  discoverIds: number[],
  countryCode: string
): { missing: number[]; found: number } {
  const dir = getDirectory(countryCode);
  if (!dir) return { missing: discoverIds, found: 0 };
  const missing = discoverIds.filter((id) => dir.ids[String(id)] !== "done");
  return { missing, found: discoverIds.length - missing.length };
}

/**
 * Ritorna le statistiche di tutti i paesi con directory locale.
 */
export function getAllDirectoryStats(): Array<{
  countryCode: string;
  countryName: string;
  total: number;
  done: number;
  failed: number;
  pending: number;
  completed: boolean;
}> {
  const stats: ReturnType<typeof getAllDirectoryStats> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("wca_dir_")) continue;
    const cc = key.replace("wca_dir_", "");
    const dir = getDirectory(cc);
    if (!dir) continue;
    const entries = Object.values(dir.ids);
    const done = entries.filter((s) => s === "done").length;
    const failed = entries.filter((s) => s === "failed").length;
    const pending = entries.filter((s) => s === "pending").length;
    stats.push({
      countryCode: cc,
      countryName: dir.countryName,
      total: entries.length,
      done,
      failed,
      pending,
      completed: pending === 0 && entries.length > 0,
    });
  }
  return stats;
}

// ── Suspended Jobs ──

export function getSuspendedJobs(): SuspendedJob[] {
  try {
    const raw = localStorage.getItem("wca_suspended_jobs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSuspendedJob(
  countryCode: string,
  countryName: string,
  pendingIds: number[],
  allMemberCount: number
): void {
  const jobs = getSuspendedJobs().filter((j) => j.countryCode !== countryCode);
  jobs.push({
    countryCode,
    countryName,
    pendingIds,
    allMemberCount,
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem("wca_suspended_jobs", JSON.stringify(jobs));
}

export function removeSuspendedJob(countryCode: string): void {
  const jobs = getSuspendedJobs().filter((j) => j.countryCode !== countryCode);
  localStorage.setItem("wca_suspended_jobs", JSON.stringify(jobs));
}

export function clearDirectory(countryCode: string): void {
  localStorage.removeItem(`wca_dir_${countryCode}`);
  removeSuspendedJob(countryCode);
}

export function clearAllDirectories(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("wca_dir_")) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("wca_suspended_jobs");
}

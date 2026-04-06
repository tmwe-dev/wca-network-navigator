/**
 * cockpitPreselection — stores source IDs of contacts just sent to cockpit
 * so they can be auto-selected when the user opens the Cockpit page.
 */

const STORAGE_KEY = "cockpit_preselect_ids";

/** Add source IDs to the preselection queue (merges with existing) */
export function addCockpitPreselection(sourceIds: string[]) {
  if (!sourceIds.length) return;
  try {
    const existing = getCockpitPreselection();
    const merged = [...new Set([...existing, ...sourceIds])];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage unavailable — skip silently
  }
}

/** Read and clear the preselection queue (consume once) */
export function consumeCockpitPreselection(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    localStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** Peek without consuming */
export function getCockpitPreselection(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

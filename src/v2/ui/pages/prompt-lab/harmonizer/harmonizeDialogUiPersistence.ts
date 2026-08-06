/**
 * Persistenza UI del dialog "Armonizza tutto".
 * Estratto da HarmonizeSystemDialog per snellire il componente.
 *
 * I file caricati non sono persistibili (sono Blob in memoria), ma persistiamo
 * il loro nome così che la UI possa ricordare all'utente cosa ricaricare.
 */
const UI_STORAGE_KEY = "harmonizerV2:dialog:ui";

export interface PersistedUi {
  goal?: string;
  agenticGoal?: string;
  ingestionGoal?: string;
  agenticFileName?: string;
  ingestionFileName?: string;
}

export function loadUi(): PersistedUi {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? "{}") as PersistedUi;
  } catch {
    return {};
  }
}

export function saveUi(patch: Partial<PersistedUi>): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...loadUi(), ...patch };
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

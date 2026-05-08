/**
 * syncGuard — Single-op mutex + cooldown throttle per WhatsApp/LinkedIn.
 *
 * Regole tassative:
 *  - una sola operazione attiva per canale, mai sovrapposizioni
 *  - prima di ogni azione bridge è obbligatorio `await throttle(channel, kind)`
 *  - i tempi sono letti da `localStorage.sync_guard_settings_v1` con fallback
 *    ai default umani; l'utente può alzare i tempi ma non bypassarli.
 *
 * Emette eventi DOM `sync-guard-state` consumati dall'indicatore "poliziotto".
 */

export type GuardChannel = "whatsapp" | "linkedin";
export type GuardStepKind =
  | "ping"
  | "cookie"
  | "open"
  | "read"
  | "scroll"
  | "betweenThreads"
  | "close";

export type GuardState = "idle" | "active" | "waiting";

export interface GuardSnapshot {
  channel: GuardChannel;
  state: GuardState;
  step: string | null;
  waitMsRemaining: number;
  waitMsTotal: number;
  startedAt: number | null;
}

const SETTINGS_KEY = "sync_guard_settings_v1";

interface StepRange { min: number; max: number }
interface Settings { [k: string]: StepRange }

const DEFAULTS: Record<GuardStepKind, StepRange> = {
  ping:           { min: 300,    max: 300 },
  cookie:         { min: 5_000,  max: 5_000 },
  open:           { min: 4_000,  max: 6_000 },
  read:           { min: 2_000,  max: 3_000 },
  scroll:         { min: 2_000,  max: 4_000 },
  betweenThreads: { min: 15_000, max: 20_000 },
  close:          { min: 3_000,  max: 3_000 },
};

function loadSettings(): Record<GuardStepKind, StepRange> {
  try {
    const raw = typeof localStorage !== "undefined"
      ? localStorage.getItem(SETTINGS_KEY)
      : null;
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Settings;
    const merged = { ...DEFAULTS };
    (Object.keys(DEFAULTS) as GuardStepKind[]).forEach((k) => {
      const v = parsed[k];
      if (v && typeof v.min === "number" && typeof v.max === "number") {
        merged[k] = {
          min: Math.max(DEFAULTS[k].min, v.min), // mai sotto i default
          max: Math.max(DEFAULTS[k].max, v.max),
        };
      }
    });
    return merged;
  } catch {
    return DEFAULTS;
  }
}

function jitter(range: StepRange): number {
  if (range.max <= range.min) return range.min;
  return Math.round(range.min + Math.random() * (range.max - range.min));
}

// ── Mutex per canale ──
const locks: Record<GuardChannel, { token: symbol; opName: string } | null> = {
  whatsapp: null,
  linkedin: null,
};

// ── Stato corrente per canale (per indicatore) ──
const state: Record<GuardChannel, GuardSnapshot> = {
  whatsapp: { channel: "whatsapp", state: "idle", step: null, waitMsRemaining: 0, waitMsTotal: 0, startedAt: null },
  linkedin: { channel: "linkedin", state: "idle", step: null, waitMsRemaining: 0, waitMsTotal: 0, startedAt: null },
};

function emit(channel: GuardChannel) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sync-guard-state", {
    detail: { ...state[channel] },
  }));
}

export function getGuardSnapshot(channel: GuardChannel): GuardSnapshot {
  return { ...state[channel] };
}

export class SyncGuardBusyError extends Error {
  constructor(public channel: GuardChannel, public currentOp: string) {
    super(`Operazione ${channel} già in corso (${currentOp})`);
    this.name = "SyncGuardBusyError";
  }
}

export interface GuardToken {
  channel: GuardChannel;
  opName: string;
  release: () => void;
}

export function tryAcquire(channel: GuardChannel, opName: string): GuardToken {
  const cur = locks[channel];
  if (cur) throw new SyncGuardBusyError(channel, cur.opName);
  const token = Symbol(opName);
  locks[channel] = { token, opName };
  state[channel] = {
    channel, state: "active", step: opName,
    waitMsRemaining: 0, waitMsTotal: 0, startedAt: Date.now(),
  };
  emit(channel);
  let released = false;
  return {
    channel,
    opName,
    release: () => {
      if (released) return;
      released = true;
      if (locks[channel]?.token === token) locks[channel] = null;
      state[channel] = {
        channel, state: "idle", step: null,
        waitMsRemaining: 0, waitMsTotal: 0, startedAt: null,
      };
      emit(channel);
    },
  };
}

export function isBusy(channel: GuardChannel): boolean {
  return locks[channel] !== null;
}

/**
 * Attesa cooldown obbligatoria. Da chiamare PRIMA di ogni azione bridge.
 * Aggiorna lo stato "waiting" con countdown live (tick ogni 200ms).
 */
export async function throttle(
  channel: GuardChannel,
  kind: GuardStepKind,
  stepLabel?: string,
): Promise<void> {
  const settings = loadSettings();
  const ms = jitter(settings[kind]);
  const startedAt = Date.now();
  state[channel] = {
    channel,
    state: "waiting",
    step: stepLabel ?? kind,
    waitMsRemaining: ms,
    waitMsTotal: ms,
    startedAt,
  };
  emit(channel);

  await new Promise<void>((resolve) => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, ms - elapsed);
      state[channel] = { ...state[channel], waitMsRemaining: remaining };
      emit(channel);
      if (remaining <= 0) {
        clearInterval(tick);
        resolve();
      }
    }, 250);
  });

  // Torna in active fino al prossimo throttle o release
  state[channel] = {
    ...state[channel],
    state: "active",
    step: stepLabel ?? kind,
    waitMsRemaining: 0,
  };
  emit(channel);
}

export function setStep(channel: GuardChannel, label: string) {
  if (!locks[channel]) return;
  state[channel] = { ...state[channel], state: "active", step: label, waitMsRemaining: 0 };
  emit(channel);
}
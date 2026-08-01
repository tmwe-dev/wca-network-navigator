/**
 * multichannelTiming — Calcolo slot di invio per bulk multichannel (LI/WA)
 *
 * Rispetta:
 *  - finestra oraria operativa (start_hour..end_hour) configurabile da app_settings
 *  - delay random fra min e max secondi configurabile per canale
 *  - se uno slot cade fuori finestra, viene spostato all'inizio della finestra del giorno successivo
 */

export interface ChannelTimingConfig {
  startHour: number;       // 0-23
  endHour: number;         // 0-23 (esclusivo: send window è [start, end))
  minDelaySeconds: number;
  maxDelaySeconds: number;
}

const DEFAULT_LI_TIMING: ChannelTimingConfig = {
  startHour: 9,
  endHour: 19,
  minDelaySeconds: 45,
  maxDelaySeconds: 180,
};

const DEFAULT_WA_TIMING: ChannelTimingConfig = {
  startHour: 8,
  endHour: 21,
  minDelaySeconds: 4,
  maxDelaySeconds: 12,
};

function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 9;
  return Math.max(0, Math.min(23, Math.floor(h)));
}

function clampToWindow(date: Date, cfg: ChannelTimingConfig): Date {
  const d = new Date(date);
  const h = d.getHours();
  if (h < cfg.startHour) {
    d.setHours(cfg.startHour, 0, 0, 0);
    return d;
  }
  if (h >= cfg.endHour) {
    d.setDate(d.getDate() + 1);
    d.setHours(cfg.startHour, 0, 0, 0);
    return d;
  }
  return d;
}

export function parseTimingFromSettings(
  settings: Record<string, string> | undefined,
  channel: "linkedin" | "whatsapp",
): ChannelTimingConfig {
  const defaults = channel === "linkedin" ? DEFAULT_LI_TIMING : DEFAULT_WA_TIMING;
  const prefix = channel === "linkedin" ? "linkedin" : "whatsapp";
  const get = (key: string) => settings?.[`${prefix}_${key}`];
  const startHour = clampHour(Number(get("send_start_hour") ?? defaults.startHour));
  const endHour = clampHour(Number(get("send_end_hour") ?? defaults.endHour));
  const minDelay = Math.max(1, Number(get("min_delay_seconds") ?? defaults.minDelaySeconds));
  const maxDelay = Math.max(minDelay, Number(get("max_delay_seconds") ?? defaults.maxDelaySeconds));
  return {
    startHour,
    endHour: endHour > startHour ? endHour : startHour + 1,
    minDelaySeconds: minDelay,
    maxDelaySeconds: maxDelay,
  };
}

/**
 * Calcola il prossimo slot a partire da `prev` aggiungendo un delay random e rispettando la finestra.
 * Se il prev è null/passato, parte da `now()`.
 */
function nextSendSlot(prev: Date | null, cfg: ChannelTimingConfig, now: Date = new Date()): Date {
  const base = prev && prev.getTime() > now.getTime() ? prev : now;
  const delaySec = cfg.minDelaySeconds + Math.random() * (cfg.maxDelaySeconds - cfg.minDelaySeconds);
  const candidate = new Date(base.getTime() + delaySec * 1000);
  return clampToWindow(candidate, cfg);
}

/**
 * Pre-calcola gli N slot per un batch.
 */
export function buildSchedule(count: number, cfg: ChannelTimingConfig, startFrom: Date = new Date()): Date[] {
  const slots: Date[] = [];
  // primo slot: almeno 30s nel futuro per permettere all'estensione di ricevere la coda
  let prev: Date = clampToWindow(new Date(startFrom.getTime() + 30_000), cfg);
  slots.push(prev);
  for (let i = 1; i < count; i++) {
    prev = nextSendSlot(prev, cfg, prev);
    slots.push(prev);
  }
  return slots;
}

export function estimateBatchDuration(count: number, cfg: ChannelTimingConfig): { lastSlot: Date; humanLabel: string } {
  if (count <= 0) return { lastSlot: new Date(), humanLabel: "—" };
  const slots = buildSchedule(count, cfg);
  const last = slots[slots.length - 1];
  return {
    lastSlot: last,
    humanLabel: last.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }),
  };
}

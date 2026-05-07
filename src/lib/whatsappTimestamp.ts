/**
 * WhatsApp timestamp parser — multilingual.
 * Returns ISO string when parseable, null otherwise.
 */
const WEEKDAYS_IT = ["domenic", "luned", "marted", "mercoled", "gioved", "venerd", "sabato"];
const WEEKDAYS_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_SHORT_EN = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function applyHHMM(date: Date, hhmm: string): Date {
  const m = hhmm.match(/^(\d{1,2})[:.](\d{2})/);
  if (m) date.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return date;
}

function findMonth(token: string): number {
  const t = token.toLowerCase().slice(0, 3);
  let i = MONTHS_IT.indexOf(t);
  if (i >= 0) return i;
  i = MONTHS_EN.indexOf(t);
  return i;
}

function findWeekday(token: string): number {
  const t = token.toLowerCase();
  for (let i = 0; i < WEEKDAYS_IT.length; i++) {
    if (t.startsWith(WEEKDAYS_IT[i]) || t.startsWith(WEEKDAYS_EN[i]) || t.startsWith(WEEKDAY_SHORT_EN[i])) return i;
  }
  return -1;
}

export function parseWhatsAppTimestamp(rawValue: string, now: Date = new Date()): string | null {
  const raw = (rawValue || "").trim();
  if (!raw) return null;

  // Native ISO / parseable
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(raw)) return parsed.toISOString();

  const lower = raw.toLowerCase();
  const hhmmMatch = raw.match(/(\d{1,2})[:.](\d{2})/);

  // HH:MM only → today
  if (/^\d{1,2}[:.]\d{2}$/.test(raw)) {
    const d = new Date(now);
    return applyHHMM(d, raw).toISOString();
  }

  // "oggi" / "today"
  if (/^(oggi|today)/i.test(lower)) {
    const d = new Date(now);
    if (hhmmMatch) applyHHMM(d, hhmmMatch[0]); else d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  // "ieri" / "yesterday"
  if (/^(ieri|yesterday)/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    if (hhmmMatch) applyHHMM(d, hhmmMatch[0]); else d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }

  // weekday → most recent past occurrence
  const weekday = findWeekday(lower);
  if (weekday >= 0) {
    const d = new Date(now);
    const diff = (d.getDay() - weekday + 7) % 7 || 7;
    d.setDate(d.getDate() - diff);
    if (hhmmMatch) applyHHMM(d, hhmmMatch[0]); else d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }

  // "dd MMM" / "MMM dd" / "dd/MM/yyyy"
  const ddmmYyyy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (ddmmYyyy) {
    const day = Number(ddmmYyyy[1]);
    const month = Number(ddmmYyyy[2]) - 1;
    let year = Number(ddmmYyyy[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (hhmmMatch) applyHHMM(d, hhmmMatch[0]);
    return d.toISOString();
  }

  const ddMmm = raw.match(/(\d{1,2})\s+([A-Za-z]{3,})/);
  if (ddMmm) {
    const month = findMonth(ddMmm[2]);
    if (month >= 0) {
      const d = new Date(now);
      d.setMonth(month, Number(ddMmm[1]));
      if (d.getTime() > now.getTime()) d.setFullYear(d.getFullYear() - 1);
      if (hhmmMatch) applyHHMM(d, hhmmMatch[0]); else d.setHours(12, 0, 0, 0);
      return d.toISOString();
    }
  }

  const mmmDd = raw.match(/^([A-Za-z]{3,})\s+(\d{1,2})/);
  if (mmmDd) {
    const month = findMonth(mmmDd[1]);
    if (month >= 0) {
      const d = new Date(now);
      d.setMonth(month, Number(mmmDd[2]));
      if (d.getTime() > now.getTime()) d.setFullYear(d.getFullYear() - 1);
      if (hhmmMatch) applyHHMM(d, hhmmMatch[0]); else d.setHours(12, 0, 0, 0);
      return d.toISOString();
    }
  }

  return null;
}

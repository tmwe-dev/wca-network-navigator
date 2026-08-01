export function minutesUntilTomorrow9(): number {
  const now = new Date();
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  return Math.max(1, Math.round((t.getTime() - now.getTime()) / 60_000));
}

export function minutesUntilNextMonday9(): number {
  const now = new Date();
  const t = new Date(now);
  const day = t.getDay();
  const daysToMon = ((1 - day + 7) % 7) || 7;
  t.setDate(t.getDate() + daysToMon);
  t.setHours(9, 0, 0, 0);
  return Math.max(1, Math.round((t.getTime() - now.getTime()) / 60_000));
}
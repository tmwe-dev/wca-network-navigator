export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function aggregateBy<T>(rows: T[], key: keyof T): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = String(row[key] ?? "—");
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([k, count]) => ({ key: k, count }))
    .sort((a, b) => b.count - a.count);
}

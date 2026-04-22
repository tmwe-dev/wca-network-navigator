import type { TabKey } from "./types";

export const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "events", label: "Eventi pagina", icon: "📊" },
  { key: "requests", label: "Chiamate edge", icon: "⚡" },
  { key: "ai", label: "Richieste AI", icon: "🤖" },
];

export const RANGES: { key: string; label: string; hours: number }[] = [
  { key: "1h", label: "Ultima ora", hours: 1 },
  { key: "24h", label: "Ultime 24h", hours: 24 },
  { key: "7d", label: "Ultimi 7 giorni", hours: 24 * 7 },
  { key: "30d", label: "Ultimi 30 giorni", hours: 24 * 30 },
];

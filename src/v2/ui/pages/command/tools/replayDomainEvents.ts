/**
 * Tool: replay-domain-events — Write/approval (manutenzione). Re-esegue eventi dominio in finestra.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractWindow(prompt: string): { from?: string; eventType?: string } {
  const days = prompt.match(/\b(\d{1,3})\s*(giorni|giorno|days|d)\b/i);
  const type = prompt.match(/\bevento\s+["“”']?([a-z_.-]{3,40})["“”']?/i);
  const out: { from?: string; eventType?: string } = {};
  if (days) {
    const d = parseInt(days[1], 10);
    out.from = new Date(Date.now() - d * 86400_000).toISOString();
  }
  if (type) out.eventType = type[1];
  return out;
}

export const replayDomainEventsTool: Tool = {
  id: "replay-domain-events",
  label: "Replay eventi dominio",
  description: "Re-esegue gli eventi del domain event log su una finestra temporale (manutenzione).",
  match: (p) => /\b(replay|riproduci|riesegui|reprocess)\b[^.]{0,30}\b(eventi|events|domain)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const win = extractWindow(prompt);
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Eseguire replay eventi?",
        description: "Operazione di manutenzione. Può rieseguire side-effect: usare con cautela.",
        details: [
          { label: "Da", value: win.from ?? "(default backend)" },
          { label: "Tipo evento", value: win.eventType ?? "tutti" },
        ],
        governance: { role: "DIRETTORE", permission: "EXECUTE:REPLAY_EVENTS", policy: "POLICY v1.0 · EVENT-REPLAY" },
        pendingPayload: { from: win.from, event_type: win.eventType },
        toolId: "replay-domain-events",
      };
    }
    const p = context.payload ?? {};
    const res = await invokeEdge<{ replayed?: number; failed?: number; message?: string; error?: string }>(
      "replay-domain-events",
      { body: { from: p.from ?? null, event_type: p.event_type ?? null }, context: "command:replay-domain-events" },
    );
    return {
      kind: "result",
      title: res?.error ? "Replay fallito" : "Replay completato",
      message: res?.error ?? res?.message ?? `Eventi rieseguiti: ${res?.replayed ?? 0} · falliti: ${res?.failed ?? 0}`,
      meta: { count: res?.replayed ?? 0, sourceLabel: "Edge · replay-domain-events" },
    };
  },
};
/**
 * Tool: update-partner-status — Update partner status (requires approval).
 *
 * Accetta dal planner uno di:
 *   - { partner_id: uuid, lead_status }
 *   - { partner_ref: "Rossi Srl" | uuid, lead_status }
 *   - { partner_name, lead_status }
 * Fallback regex sul prompt umano.
 */
import { updatePartner } from "@/v2/io/supabase/mutations/partners";
import { isOk } from "@/v2/core/domain/result";
import type { Tool, ToolResult, ToolContext } from "./types";
import { mergePayload, resolvePartnerRef, isUuid } from "./_helpers/writePayload";

function fallbackFromPrompt(prompt: string): Record<string, unknown> {
  const idMatch = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const nameMatch = prompt.match(
    /partner\s+["']?([A-Za-z0-9][\w\s&.\-']+?)["']?(?:\s+(?:a|come|stato|status)\b|[,.]|$)/i,
  );
  const statusMatch = prompt.match(/(?:stato|status|come|a)\s+["']?([\w-]+)/i);
  return {
    partner_id: idMatch?.[0] ?? "",
    partner_ref: nameMatch?.[1]?.trim() ?? "",
    lead_status: statusMatch?.[1]?.toLowerCase() ?? "",
  };
}

function pickRef(p: Record<string, unknown>): string {
  return String(p.partner_id || p.partner_ref || p.partner_name || "").trim();
}

export const updatePartnerStatusTool: Tool = {
  id: "update-partner-status",
  label: "Aggiorna stato partner",
  description: "Cambia lo stato commerciale di un partner WCA",
  match: (p) => /(marca|imposta|cambia stato|aggiorna).*partner/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const payload = mergePayload(context?.payload, fallbackFromPrompt(prompt));
    const ref = pickRef(payload);
    const newStatus = String(payload.lead_status ?? "").toLowerCase();

    if (!context?.confirmed) {
      // Risolve preview (solo per label leggibile). Non blocca se non trovato.
      let displayName = ref;
      if (ref && !isUuid(ref)) {
        const resolved = await resolvePartnerRef(ref);
        if (resolved) displayName = `${resolved.company_name} (${resolved.id.slice(0, 8)}…)`;
      }
      return {
        kind: "approval",
        title: "Aggiornare stato partner?",
        description: "Lo stato commerciale del partner verrà modificato.",
        details: [
          { label: "Partner", value: displayName || "(seleziona partner)" },
          { label: "Nuovo stato", value: newStatus || "(da specificare)" },
        ],
        governance: { role: "COMMERCIALE", permission: "WRITE:PARTNERS", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: payload,
        toolId: "update-partner-status",
      };
    }

    if (!ref) throw new Error("Riferimento partner mancante (partner_id o partner_ref)");
    if (!newStatus) throw new Error("Nuovo stato mancante (lead_status)");

    const resolved = await resolvePartnerRef(ref);
    if (!resolved) throw new Error(`Partner "${ref}" non trovato`);

    const result = await updatePartner(resolved.id, { lead_status: newStatus });
    if (!isOk(result)) throw new Error(result.error.message);

    return {
      kind: "result",
      title: "Stato partner aggiornato",
      message: `${resolved.company_name} → stato "${newStatus}".`,
      meta: { count: 1, sourceLabel: "Supabase · partners" },
    };
  },
};

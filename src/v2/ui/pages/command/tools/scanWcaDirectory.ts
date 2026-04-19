import type { Tool, ToolResult } from "./types";
import { scanDirectory } from "@/lib/acquisition/scanDirectory";

const COUNTRY_MAP: Record<string, string> = {
  "stati uniti": "US",
  "stati uniti damerica": "US",
  "stati uniti d'america": "US",
  usa: "US",
  us: "US",
  "united states": "US",
  america: "US",
};

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCountryCode(prompt: string): string | null {
  const normalized = normalizePrompt(prompt);

  for (const [label, code] of Object.entries(COUNTRY_MAP)) {
    if (normalized.includes(label)) return code;
  }

  const explicitCode = normalized.match(/\b([A-Z]{2}|[a-z]{2})\b/);
  if (explicitCode) return explicitCode[1].toUpperCase();

  return null;
}

export const scanWcaDirectoryTool: Tool = {
  id: "scan-wca-directory",
  label: "Scan directory WCA",
  description: "Scansiona la directory WCA per un paese e mostra i membri trovati, anche se il DB locale è vuoto",
  match: (prompt) => {
    const p = normalizePrompt(prompt);
    return /(scan|scansiona|cerca|mappa|recupera).*(directory|wca)/i.test(p) || /directory.*(usa|us|stati uniti|united states)/i.test(p);
  },

  execute: async (prompt): Promise<ToolResult> => {
    const countryCode = extractCountryCode(prompt);

    if (!countryCode) {
      return {
        kind: "result",
        title: "Paese mancante",
        message: "Specifica il paese da scansionare nella directory WCA, ad esempio: Scan Directory US.",
        meta: { count: 0, sourceLabel: "Command · parser" },
      };
    }

    const { queue, scanStats } = await scanDirectory([countryCode], []);

    return {
      kind: "table",
      title: `WCA DIRECTORY · SCAN ${countryCode}`,
      columns: [
        { key: "wca_id", label: "WCA ID" },
        { key: "company_name", label: "Azienda" },
        { key: "city", label: "Città" },
        { key: "country_code", label: "Paese" },
        { key: "status", label: "Stato" },
        { key: "alreadyDownloaded", label: "Nel DB" },
      ],
      rows: queue.map((item) => ({
        id: String(item.wca_id),
        wca_id: item.wca_id,
        company_name: item.company_name ?? "—",
        city: item.city ?? "—",
        country_code: item.country_code ?? countryCode,
        status: item.status ?? "pending",
        alreadyDownloaded: item.alreadyDownloaded ? "Sì" : "No",
      })),
      meta: {
        count: scanStats.total,
        sourceLabel: "WCA Directory · live scan",
      },
      selectable: true,
      idField: "id",
      liveSource: "download_jobs",
      bulkActions: [
        { id: "import-selected", label: "Importa selezionati", promptTemplate: "Importa dalla directory WCA i membri con wca_id: {ids}" },
        { id: "qualify-selected", label: "Qualifica selezionati", promptTemplate: "Qualifica i partner WCA con wca_id: {ids}" },
      ],
    };
  },
};

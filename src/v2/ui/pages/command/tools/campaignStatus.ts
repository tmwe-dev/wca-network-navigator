import { fetchCampaignJobs } from "@/v2/io/supabase/queries/campaigns";
import type { Tool, ToolResult } from "./types";

function _jobStatusToNodeType(status: string): "trigger" | "action" | "condition" | "end" {
  switch (status) {
    case "completed":
      return "end";
    case "in_progress":
      return "action";
    case "skipped":
      return "condition";
    default:
      return "trigger";
  }
}

export const campaignStatusTool: Tool = {
  id: "campaign-status",
  label: "Stato campagne attive",
  description: "Mostra le campagne in corso e le loro metriche",

  match(prompt: string): boolean {
    const p = prompt.toLowerCase();
    // Esclude prompt che puntano alla knowledge base: search-kb ha precedenza semantica.
    if (/\b(kb|knowledge\s*base)\b/.test(p)) return false;
    // Domande "come si fa…" sono richieste di documentazione, non di stato.
    if (/\bcome\s+(si\s+fa|si\s+|posso|devo)\b/.test(p)) return false;
    // Documentazione o creazione: non è una lettura di stato campagne.
    if (/\b(workflow|guida|procedura|documentazione)\b/.test(p)) return false;
    if (/\b(crea|creare|nuova)\b/.test(p)) return false;
    return /campagn|campaign|lancia|flusso/.test(p);
  },

  async execute(): Promise<ToolResult> {
    const res = await fetchCampaignJobs();
    if (res._tag === "Err") {
      return {
        kind: "result",
        title: "Stato campagne non disponibile",
        message: `Impossibile leggere le campagne: ${res.error.message ?? "errore sconosciuto"}`,
        status: "error",
        meta: { count: 0, sourceLabel: "Supabase · campaign_jobs" },
      };
    }

    const jobs = res.value;

    // Group by batchId
    const batches = new Map<string, typeof jobs>();
    for (const job of jobs) {
      const key = job.batchId as string;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key)!.push(job);
    }

    // Build flow nodes: one summary node per batch + top jobs
    const nodes: Array<{ label: string; type: "trigger" | "action" | "condition" | "end"; detail?: string }> = [];

    let batchIdx = 0;
    for (const [batchId, batchJobs] of batches) {
      if (batchIdx >= 6) break; // max 6 batches
      const pending = batchJobs.filter((j) => j.status === "pending").length;
      const inProgress = batchJobs.filter((j) => j.status === "in_progress").length;
      const completed = batchJobs.filter((j) => j.status === "completed").length;
      const total = batchJobs.length;
      const country = batchJobs[0]?.countryName ?? "—";
      const jobType = batchJobs[0]?.jobType ?? "email";

      nodes.push({
        label: `Batch ${batchId.slice(0, 8)}… · ${country}`,
        type: "trigger",
        detail: `${total} job · tipo: ${jobType}`,
      });
      nodes.push({
        label: `${completed}/${total} completati · ${inProgress} in corso · ${pending} in coda`,
        type: completed === total ? "end" : inProgress > 0 ? "action" : "condition",
        detail: completed === total ? "Batch completato" : `Progresso: ${Math.round((completed / total) * 100)}%`,
      });
      batchIdx++;
    }

    if (nodes.length === 0) {
      nodes.push({
        label: "Nessuna campagna trovata",
        type: "end",
        detail: "Nessun job presente nel database",
      });
    }

    return {
      kind: "flow",
      title: `Campagne · ${batches.size} batch`,
      meta: { count: jobs.length, sourceLabel: "Supabase · campaign_jobs" },
      nodes,
    };
  },
};

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * System Architecture Map — Pagina di riferimento per la struttura completa del sistema.
 * Generata dall'analisi del codebase. Serve come guida operativa.
 */

const LAYERS = [
  {
    name: "1. Connettori Sorgente",
    status: "operational",
    modules: [
      { name: "WCA Chrome Extension", files: ["public/chrome-extension/"], status: "operational", notes: "V4 — contratto strict, error codes stabili" },
      { name: "LinkedIn Extension", files: ["public/linkedin-extension/"], status: "partial", notes: "Bridge presente, estrazione limitata" },
      { name: "RA Extension", files: ["public/ra-extension/"], status: "partial", notes: "Prospect import, non download massivo" },
      { name: "CSV/XLSX Import", files: ["src/lib/import/"], status: "operational", notes: "Parser multi-formato con AI mapping" },
    ],
  },
  {
    name: "2. Pipeline Download",
    status: "operational",
    modules: [
      { name: "Engine V8", files: ["src/hooks/useWcaAppDownload.ts"], status: "operational", notes: "Claude Engine V8 — auto-login, localDirectory, zero bridge" },
      { name: "Progress UI", files: ["src/components/download/DownloadProgressBar.tsx"], status: "operational", notes: "Widget compatto fase/progresso/stop/riprendi" },
      { name: "Job State", files: ["src/lib/download/jobState.ts"], status: "operational", notes: "claim/update/snapshot/finalize, 131 righe" },
      { name: "Profile Saver", files: ["src/lib/download/profileSaver.ts"], status: "operational", notes: "Batch ops, unico writer, 208 righe" },
      { name: "Job Tracking", files: ["src/hooks/useDownloadJobs.ts"], status: "operational", notes: "CRUD + realtime singleton, 287 righe" },
      { name: "Health Monitor", files: ["src/hooks/useJobHealthMonitor.ts"], status: "operational", notes: "Solo osservazione, 63 righe" },
    ],
  },
  {
    name: "3. CRM Core",
    status: "operational",
    modules: [
      { name: "Partners", files: ["src/hooks/usePartners.ts", "src/components/partners/"], status: "operational", notes: "CRUD + rating + enrichment" },
      { name: "Contacts (WCA)", files: ["src/hooks/useContacts.ts", "src/components/contacts/"], status: "operational", notes: "partner_contacts linked" },
      { name: "Prospects (RA)", files: ["src/hooks/useProspects.ts", "src/components/prospects/"], status: "operational", notes: "Import + ATECO grid" },
      { name: "Import System", files: ["src/hooks/useImportWizard.ts", "src/components/import/"], status: "operational", notes: "AI reasoning-first mapper" },
      { name: "Business Cards", files: ["src/hooks/useBusinessCards.ts"], status: "operational", notes: "Auto-match trigger" },
    ],
  },
  {
    name: "4. Comunicazione & Outreach",
    status: "operational",
    modules: [
      { name: "Cockpit", files: ["src/components/cockpit/", "src/hooks/useCockpitContacts.ts"], status: "operational", notes: "Convergenza 3 sorgenti (WCA/Import/RA)" },
      { name: "Email Generator", files: ["src/hooks/useEmailGenerator.ts", "supabase/functions/generate-email/"], status: "operational", notes: "Prompt 7-layer" },
      { name: "Email Queue", files: ["src/hooks/useEmailCampaignQueue.ts", "supabase/functions/process-email-queue/"], status: "operational", notes: "SMTP Aruba, delay variabile" },
      { name: "Workspace", files: ["src/components/workspace/", "src/pages/Workspace.tsx"], status: "operational", notes: "Email composer + doc upload" },
    ],
  },
  {
    name: "5. Orchestrazione AI",
    status: "operational",
    modules: [
      { name: "AI Assistant", files: ["supabase/functions/ai-assistant/"], status: "operational", notes: "2796 righe, 42+ tool, KBO 22 procedure" },
      { name: "Agent Execute", files: ["supabase/functions/agent-execute/"], status: "operational", notes: "1263 righe, tool-calling loop (10 iter)" },
      { name: "Daily Briefing", files: ["supabase/functions/daily-briefing/"], status: "operational", notes: "Aggregazione real-time + LLM summary" },
      { name: "11 Agenti", files: ["src/data/agentTemplates.ts", "src/hooks/useAgents.ts"], status: "operational", notes: "Specializzati per ruolo" },
      { name: "AI Memory", files: ["src/hooks/useAIConversation.ts"], status: "operational", notes: "Persistent context per utente" },
    ],
  },
  {
    name: "6. Governance & Audit",
    status: "operational",
    modules: [
      { name: "Download Events", files: ["download_job_events (DB)"], status: "operational", notes: "Append-only log" },
      { name: "Download Items", files: ["download_job_items (DB)"], status: "operational", notes: "Per-item state machine" },
      { name: "Credit System", files: ["src/hooks/useCredits.ts", "supabase/functions/consume-credits/"], status: "operational", notes: "Atomic deduction via DB function" },
      { name: "Blacklist", files: ["src/hooks/useBlacklist.ts"], status: "operational", notes: "Auto-match + WCA sync" },
    ],
  },
];

const STATS = {
  pages: 30,
  hooks: 52,
  components: 120,
  edgeFunctions: 40,
  dbTables: 35,
  totalLines: 58765,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
      status === "operational" && "bg-primary/10 text-primary",
      status === "partial" && "bg-accent/40 text-accent-foreground",
      status === "planned" && "bg-muted text-muted-foreground",
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "operational" && "bg-primary",
        status === "partial" && "bg-accent-foreground",
        status === "planned" && "bg-muted-foreground",
      )} />
      {status}
    </span>
  );
}

export default function SystemMap() {
  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">🗺️ System Architecture Map</h1>
          <p className="text-sm text-muted-foreground">
            Mappa completa del sistema — guida operativa per costruzione e debug.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {Object.entries(STATS).map(([k, v]) => (
              <span key={k} className="rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                <span className="font-semibold text-foreground">{v}</span> {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </span>
            ))}
          </div>
        </header>

        {LAYERS.map((layer) => (
          <section key={layer.name} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <h2 className="text-sm font-bold">{layer.name}</h2>
              <StatusBadge status={layer.status} />
            </div>
            <div className="divide-y divide-border/30">
              {layer.modules.map((mod) => (
                <div key={mod.name} className="flex items-start gap-3 px-4 py-3">
                  <StatusBadge status={mod.status} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{mod.name}</div>
                    <div className="text-[11px] text-muted-foreground">{mod.notes}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {mod.files.map((f) => (
                        <code key={f} className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{f}</code>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Standards Compliance */}
        <section className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-3">
          <h2 className="text-sm font-bold">📐 Standard & Best Practice Applicate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              ["Chrome Extension", "Manifest V3, service worker, scripting API, no remote code"],
              ["Rate Limiting", "Delay configurabile per-job (5-120s), no hard-coded thresholds"],
              ["Error Handling", "Codici errore stabili (WCA_*, EXT_*), bridge health separato"],
              ["Data Pipeline", "Item-level tracking, append-only event log, derived progress"],
              ["React Performance", "React.lazy su tutte le rotte, staleTime queries, singleton realtime"],
              ["Security", "RLS su tutte le tabelle, JWT validation, user-scoped data"],
              ["State Machine", "Job: pending→running→completed/paused/stopped/failed"],
              ["Single Writer", "Solo l'app scrive nel backend, l'estensione estrae e basta"],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
                <div className="font-semibold text-foreground">{title}</div>
                <div className="text-muted-foreground mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

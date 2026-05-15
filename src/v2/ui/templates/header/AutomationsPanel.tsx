/**
 * AutomationsPanel — Pannello top bar.
 * Tab "Cron job": stato dei cron schedulati + ultimi run (read-only).
 * Tab "Attività canali": ultimi messaggi WhatsApp/LinkedIn (in/out + dispatch in coda).
 * Sorgenti: RPC cron_job_status() / cron_recent_runs(), DAL channelActivity.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cog, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowDownLeft, ArrowUpRight, MessageCircle, Linkedin } from "lucide-react";
import { listCronJobStatus, listCronRecentRuns, type CronJobStatus, type CronRunRow } from "@/data/cronJobs";
import { listRecentChannelActivity, type ChannelActivityRow } from "@/data/channelActivity";
import { queryKeys } from "@/lib/queryKeys";

/** Etichette leggibili e descrizioni operative dei cron job. */
const JOB_INFO: Record<string, { label: string; desc: string }> = {
  outreach_scheduler_tick: { label: "Outreach · invio messaggi schedulati", desc: "Manda email/WA/LinkedIn pianificati ogni 5 min" },
  email_cron_sync_tick: { label: "Email · sincronizzazione caselle", desc: "Scarica nuove email IMAP da tutte le caselle attive" },
  agent_autonomous_cycle_tick: { label: "Agenti · ciclo autonomo", desc: "Gli agenti decidono prossime azioni sui lead" },
  agent_autopilot_worker_tick: { label: "Autopilot · esecuzione missioni", desc: "Avanza missioni autopilot attive (KPI/budget)" },
  agent_task_drainer_tick: { label: "Agenti · esecuzione task in coda", desc: "Esegue tool richiesti dagli agenti" },
  "agent-prompt-refiner-weekly": { label: "Prompt · raffinamento settimanale", desc: "Analizza i prompt e propone migliorie (ogni lunedì)" },
  "ai-backup": { label: "AI · backup configurazioni", desc: "Snapshot prompt, agenti, KB (settimanale)" },
  "ai-learning-feedback": { label: "AI · learning feedback", desc: "Aggrega feedback per il fine-tuning" },
  batch_enrichment_worker_tick: { label: "Arricchimento · batch worker", desc: "Arricchisce partner in coda (ogni 30 min)" },
  "cadence-engine": { label: "Cadenze · motore follow-up", desc: "Genera step successivi delle cadenze (ogni ora)" },
  "classify-emails-batch-every-5min": { label: "Email · classificazione AI", desc: "Categorizza email inbound (ogni 5 min)" },
  "cleanup-cron-runs": { label: "Manutenzione · pulizia run cron", desc: "Cancella vecchi log cron (notturno)" },
  "cleanup-rejected-actions": { label: "Manutenzione · azioni rifiutate", desc: "Pulisce ai_pending_actions scartate" },
  cron_run_log_cleanup: { label: "Manutenzione · log cron", desc: "Compatta il log dei run cron" },
  "expire-stuck-import-logs": { label: "Import · timeout job bloccati", desc: "Marca import bloccati come scaduti (ogni 15 min)" },
  "funnemail-policy-engine-10min": { label: "Funnemail · policy engine", desc: "Applica policy editoriali alle email (10 min)" },
  "funnemail-reminders-tick-1min": { label: "Funnemail · reminder", desc: "Manda reminder follow-up (ogni minuto)" },
  kb_embed_backfill_daily: { label: "KB · embedding backfill", desc: "Calcola embedding mancanti della Knowledge Base" },
  "kb-doctrine-audit-weekly": { label: "KB · audit dottrina", desc: "Verifica duplicati e qualità KB (settimanale)" },
  "kb-promoter": { label: "KB · promozione contenuti", desc: "Promuove voci KB di alto valore" },
  memory_embed_backfill_daily: { label: "Memoria · embedding backfill", desc: "Indicizza memorie persistenti" },
  "memory-promoter": { label: "Memoria · promozione", desc: "Promuove memorie rilevanti" },
  "process-inbound-enrichment-every-minute": { label: "Inbound · arricchimento", desc: "Arricchisce email/contatti in ingresso (ogni minuto)" },
  "prompt-test-runner-nightly": { label: "Prompt · test di regressione", desc: "Esegue test cases sui prompt (notte)" },
  "purge-runtime-traces": { label: "Trace · purge runtime", desc: "Pulisce trace AI vecchi" },
  "smart-scheduler": { label: "Smart Scheduler", desc: "Orchestratore generale delle automazioni (5:00)" },
};

function infoFor(jobname: string): { label: string; desc: string } {
  return JOB_INFO[jobname] ?? { label: jobname, desc: "Job di sistema" };
}

function statusIcon(status: string | null): React.ReactNode {
  const s = (status ?? "").toLowerCase();
  if (s === "succeeded" || s === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (s === "failed" || s === "error") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (s === "running" || s === "starting") return <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />;
  if (!status) return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "mai";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ora";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

function channelIcon(channel: string): React.ReactNode {
  if (channel === "linkedin") return <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />;
  if (channel === "whatsapp") return <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />;
  return <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function dispatchStatusLabel(s: string | null | undefined): string {
  switch (s) {
    case "pending": return "in attesa";
    case "queued": return "in coda";
    case "processing": return "in invio";
    case "sent": return "inviato";
    case "delivered": return "consegnato";
    case "failed": return "fallito";
    case "skipped": return "saltato";
    default: return s ?? "—";
  }
}

type TabKey = "cron" | "channels";

export function AutomationsPanel(): React.ReactElement {
  const [tab, setTab] = React.useState<TabKey>("cron");

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<CronJobStatus[]>({
    queryKey: queryKeys.cronJobs.list,
    queryFn: listCronJobStatus,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const { data: runs = [], isLoading: loadingRuns } = useQuery<CronRunRow[]>({
    queryKey: queryKeys.cronJobs.runs(30),
    queryFn: () => listCronRecentRuns(30),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const { data: activity = [], isLoading: loadingAct } = useQuery<ChannelActivityRow[]>({
    queryKey: queryKeys.cronJobs.channelActivity(30),
    queryFn: () => listRecentChannelActivity(30),
    refetchInterval: 20_000,
    staleTime: 10_000,
    enabled: tab === "channels",
  });

  const totalActive = jobs.filter((j) => j.active).length;
  const failed24h = runs.filter((r) => {
    const s = (r.status ?? "").toLowerCase();
    if (s !== "failed" && s !== "error") return false;
    return Date.now() - new Date(r.start_time).getTime() < 24 * 3600_000;
  }).length;

  const dot = failed24h > 0 ? "bg-amber-500" : totalActive > 0 ? "bg-emerald-500" : "bg-muted";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" aria-label="Automazioni" title="Automazioni">
          <Cog className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden xl:inline text-muted-foreground">Automazioni</span>
          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          {failed24h > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[10px] text-amber-600 border-amber-500/40">{failed24h}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[34rem] max-w-[calc(100vw-1rem)] p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <Cog className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Automazioni</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{totalActive} attivi</Badge>
            {failed24h > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">{failed24h} falliti 24h</Badge>
            )}
          </div>
        </div>

        <div className="inline-flex rounded-md bg-muted p-0.5 text-xs font-medium">
          <button
            onClick={() => setTab("cron")}
            className={`px-3 py-1 rounded-sm transition ${tab === "cron" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >Cron job</button>
          <button
            onClick={() => setTab("channels")}
            className={`px-3 py-1 rounded-sm transition ${tab === "channels" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >Attività canali</button>
        </div>

        {tab === "cron" && (
          <>
            <section>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Job schedulati</div>
              <ScrollArea className="h-[200px] pr-2">
                {loadingJobs && <div className="text-xs text-muted-foreground">Caricamento…</div>}
                {!loadingJobs && jobs.length === 0 && <div className="text-xs text-muted-foreground">Nessun cron job configurato.</div>}
                <ul className="space-y-1">
                  {jobs.map((j) => {
                    const info = infoFor(j.jobname);
                    return (
                      <li key={j.jobname} className="flex items-start justify-between gap-2 text-xs rounded-md px-1.5 py-1 hover:bg-muted/50">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="mt-0.5">{statusIcon(j.last_status)}</span>
                          <div className="min-w-0">
                            <div className={`truncate font-medium ${j.active ? "" : "text-muted-foreground line-through"}`} title={j.jobname}>
                              {info.label}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground" title={info.desc}>
                              {info.desc} · <span className="tabular-nums">{j.schedule}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums" title={j.last_run ?? ""}>
                          {relativeTime(j.last_run)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </section>

            <section className="border-t border-border/40 pt-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Ultimi run</div>
              <ScrollArea className="h-[150px] pr-2">
                {loadingRuns && <div className="text-xs text-muted-foreground">Caricamento…</div>}
                {!loadingRuns && runs.length === 0 && <div className="text-xs text-muted-foreground">Nessun run registrato.</div>}
                <ul className="space-y-1">
                  {runs.map((r, idx) => {
                    const info = infoFor(r.jobname ?? "");
                    return (
                      <li key={`${r.jobid}-${r.start_time}-${idx}`} className="flex items-center justify-between gap-2 text-xs rounded-md px-1.5 py-1 hover:bg-muted/50">
                        <div className="flex items-center gap-2 min-w-0">
                          {statusIcon(r.status)}
                          <span className="truncate" title={r.return_message ?? r.status}>{info.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums" title={r.start_time}>
                          {relativeTime(r.start_time)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </section>
          </>
        )}

        {tab === "channels" && (
          <section>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Ultime attività WhatsApp e LinkedIn
            </div>
            <ScrollArea className="h-[360px] pr-2">
              {loadingAct && <div className="text-xs text-muted-foreground">Caricamento…</div>}
              {!loadingAct && activity.length === 0 && (
                <div className="text-xs text-muted-foreground">Nessuna attività recente sui canali WhatsApp/LinkedIn.</div>
              )}
              <ul className="space-y-1">
                {activity.map((a) => {
                  const isOut = a.direction === "out";
                  const verb = a.kind === "dispatch"
                    ? `In invio (${dispatchStatusLabel(a.status)})`
                    : isOut ? "Inviato a" : "Ricevuto da";
                  return (
                    <li key={`${a.kind}-${a.id}`} className="flex items-start justify-between gap-2 text-xs rounded-md px-1.5 py-1 hover:bg-muted/50">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="mt-0.5">{channelIcon(a.channel)}</span>
                        <span className="mt-0.5">
                          {isOut ? <ArrowUpRight className="h-3 w-3 text-primary" /> : <ArrowDownLeft className="h-3 w-3 text-emerald-500" />}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate">
                            <span className="font-medium">{verb}</span>{" "}
                            <span className="text-muted-foreground">{a.who ?? "—"}</span>
                          </div>
                          {a.preview && (
                            <div className="truncate text-[10px] text-muted-foreground" title={a.preview}>
                              "{a.preview}"
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums" title={a.created_at}>
                        {relativeTime(a.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </section>
        )}
      </PopoverContent>
    </Popover>
  );
}

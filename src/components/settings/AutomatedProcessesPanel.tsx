import { useEffect, useMemo, useState } from "react";
import { Loader2, Power, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface CronCostConfig {
  key: string;
  jobName: string;
  enabledKey: string;
  intervalKey: string;
  label: string;
  description: string;
  avgTokensPerRun: number;
  costPer1MTokens: number;
  defaultIntervalMin: number;
  defaultEnabled: boolean;
}

const CRON_CONFIGS: CronCostConfig[] = [
  {
    key: "outreach_scheduler",
    jobName: "outreach_scheduler",
    enabledKey: "cron_outreach_scheduler_enabled",
    intervalKey: "cron_outreach_scheduler_interval_min",
    label: "Outreach Scheduler",
    description: "Processa email e outreach programmati in coda",
    avgTokensPerRun: 1000,
    costPer1MTokens: 0.075,
    defaultIntervalMin: 5,
    defaultEnabled: true,
  },
  {
    key: "email_sync",
    jobName: "email_sync",
    enabledKey: "cron_email_sync_enabled",
    intervalKey: "cron_email_sync_interval_min",
    label: "Email Sync",
    description: "Sincronizza inbox IMAP e classifica email in arrivo",
    avgTokensPerRun: 800,
    costPer1MTokens: 0.075,
    defaultIntervalMin: 15,
    defaultEnabled: true,
  },
  {
    key: "agent_autonomous",
    jobName: "agent_autonomous",
    enabledKey: "cron_agent_autonomous_enabled",
    intervalKey: "cron_agent_autonomous_interval_min",
    label: "Agent Autonomo",
    description: "Valuta messaggi non letti, crea task per gli agenti AI, avanza stati lead",
    avgTokensPerRun: 3000,
    costPer1MTokens: 0.075,
    defaultIntervalMin: 10,
    defaultEnabled: false,
  },
  {
    key: "autopilot_worker",
    jobName: "autopilot_worker",
    enabledKey: "cron_autopilot_worker_enabled",
    intervalKey: "cron_autopilot_worker_interval_min",
    label: "Autopilot Worker",
    description: "Avanza le missioni autopilot attive (genera email, aggiorna stati)",
    avgTokensPerRun: 5000,
    costPer1MTokens: 0.075,
    defaultIntervalMin: 30,
    defaultEnabled: true,
  },
];

const FREQUENCY_OPTIONS = [
  { label: "Ogni 1 minuto", value: 1 },
  { label: "Ogni 2 minuti", value: 2 },
  { label: "Ogni 5 minuti", value: 5 },
  { label: "Ogni 10 minuti", value: 10 },
  { label: "Ogni 15 minuti", value: 15 },
  { label: "Ogni 30 minuti", value: 30 },
  { label: "Ogni ora", value: 60 },
];

function estimateMonthlyCost(intervalMin: number, avgTokens: number, costPer1M: number): number {
  const runsPerDay = (24 * 60) / intervalMin;
  const tokensPerMonth = runsPerDay * 30 * avgTokens;
  return (tokensPerMonth / 1_000_000) * costPer1M;
}

function formatRelative(date: Date | null): string {
  if (!date) return "Mai";
  const diffMin = (Date.now() - date.getTime()) / 60000;
  if (diffMin < 1) return "ora";
  if (diffMin < 60) return `${Math.floor(diffMin)} min fa`;
  const diffH = diffMin / 60;
  if (diffH < 24) return `${Math.floor(diffH)}h fa`;
  return `${Math.floor(diffH / 24)}g fa`;
}

interface CronState {
  enabled: boolean;
  intervalMin: number;
  lastRun: Date | null;
  lastError: string | null;
  errors24h: number;
}

export default function AutomatedProcessesPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, CronState>>({});

  async function loadAll() {
    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .is("user_id", null)
        .in(
          "key",
          CRON_CONFIGS.flatMap((c) => [c.enabledKey, c.intervalKey])
        );

      const settingsMap: Record<string, string> = {};
      (settings || []).forEach((s: { key: string; value: string | null }) => {
        if (s.value !== null) settingsMap[s.key] = s.value;
      });

      const since24h = new Date(Date.now() - 86400000).toISOString();
      const { data: logs } = await supabase
        .from("cron_run_log")
        .select("job_name, ran_at, error")
        .in("job_name", CRON_CONFIGS.map((c) => c.jobName))
        .gte("ran_at", since24h)
        .order("ran_at", { ascending: false });

      const next: Record<string, CronState> = {};
      for (const cfg of CRON_CONFIGS) {
        const jobLogs = (logs || []).filter((l: any) => l.job_name === cfg.jobName);
        const lastRunRow = jobLogs[0];
        const errors24h = jobLogs.filter((l: any) => l.error).length;
        next[cfg.key] = {
          enabled:
            settingsMap[cfg.enabledKey] !== undefined
              ? settingsMap[cfg.enabledKey] !== "false"
              : cfg.defaultEnabled,
          intervalMin:
            parseInt(settingsMap[cfg.intervalKey] || "", 10) || cfg.defaultIntervalMin,
          lastRun: lastRunRow ? new Date(lastRunRow.ran_at) : null,
          lastError: jobLogs.find((l: any) => l.error)?.error || null,
          errors24h,
        };
      }
      setStates(next);
    } catch (e: any) {
      toast.error("Errore caricamento", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  async function saveSetting(key: string, value: string, configKey: string) {
    setSaving(configKey);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value, user_id: null }, { onConflict: "key,user_id" });
      if (error) throw error;
      toast.success("Salvato");
    } catch (e: any) {
      toast.error("Errore salvataggio", { description: e.message });
    } finally {
      setSaving(null);
    }
  }

  async function handleToggle(cfg: CronCostConfig, enabled: boolean) {
    setStates((s) => ({ ...s, [cfg.key]: { ...s[cfg.key], enabled } }));
    await saveSetting(cfg.enabledKey, enabled ? "true" : "false", cfg.key);
  }

  async function handleInterval(cfg: CronCostConfig, intervalMin: number) {
    setStates((s) => ({ ...s, [cfg.key]: { ...s[cfg.key], intervalMin } }));
    await saveSetting(cfg.intervalKey, String(intervalMin), cfg.key);
  }

  const totalCost = useMemo(() => {
    return CRON_CONFIGS.reduce((acc, cfg) => {
      const st = states[cfg.key];
      if (!st || !st.enabled) return acc;
      return acc + estimateMonthlyCost(st.intervalMin, cfg.avgTokensPerRun, cfg.costPer1MTokens);
    }, 0);
  }, [states]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Processi AI Automatici</h2>
        <p className="text-sm text-muted-foreground">
          Accendi/spegni e regola la frequenza dei worker automatici per controllare i costi.
        </p>
      </div>

      {CRON_CONFIGS.map((cfg) => {
        const st = states[cfg.key];
        if (!st) return null;
        const monthlyCost = estimateMonthlyCost(st.intervalMin, cfg.avgTokensPerRun, cfg.costPer1MTokens);
        const runsPerDay = Math.round((24 * 60) / st.intervalMin);
        const nextRunDate = st.lastRun
          ? new Date(st.lastRun.getTime() + st.intervalMin * 60000)
          : null;
        const nextInMin = nextRunDate ? Math.max(0, (nextRunDate.getTime() - Date.now()) / 60000) : null;

        return (
          <Card key={cfg.key} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Power className={`w-4 h-4 ${st.enabled ? "text-green-600" : "text-muted-foreground"}`} />
                  <h3 className="font-semibold">{cfg.label}</h3>
                  {!st.enabled && <Badge variant="secondary">OFF</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{cfg.description}</p>
              </div>
              <Switch
                checked={st.enabled}
                disabled={saving === cfg.key}
                onCheckedChange={(v) => handleToggle(cfg, v)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Frequenza</label>
                <Select
                  value={String(st.intervalMin)}
                  disabled={!st.enabled || saving === cfg.key}
                  onValueChange={(v) => handleInterval(cfg, parseInt(v, 10))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Costo stimato</label>
                <div className="mt-1 text-lg font-semibold">
                  {st.enabled ? `~$${monthlyCost.toFixed(2)}/mese` : "$0.00/mese"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {runsPerDay} run/g × ~{cfg.avgTokensPerRun.toLocaleString()} token
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs pt-2 border-t">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Ultimo run:</span>
                <span className="font-medium">{formatRelative(st.lastRun)}</span>
                {st.lastRun && !st.lastError && <CheckCircle2 className="w-3 h-3 text-green-600" />}
              </div>
              {st.enabled && nextInMin !== null && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Prossimo:</span>
                  <span className="font-medium">
                    {nextInMin < 1 ? "imminente" : `tra ~${Math.ceil(nextInMin)} min`}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <AlertCircle className={`w-3 h-3 ${st.errors24h > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-muted-foreground">Errori 24h:</span>
                <span className={`font-medium ${st.errors24h > 0 ? "text-destructive" : ""}`}>
                  {st.errors24h}
                </span>
              </div>
            </div>
          </Card>
        );
      })}

      <Card className="p-5 bg-muted/30 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              💰 Costo totale stimato processi automatici
            </div>
            <div className="text-2xl font-bold mt-1">~${totalCost.toFixed(2)}/mese</div>
            <div className="text-xs text-muted-foreground mt-1">
              Modello: Gemini 2.5 Flash · Non include azioni manuali (chat, email composte, ecc.)
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
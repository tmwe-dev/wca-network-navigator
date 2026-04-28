/**
 * SystemDiagnosticsBadge — P3.9
 * Mostra un piccolo badge admin-only con stato sistema in tempo reale.
 * Click → expand con dettagli (queue counts, cron, ultima sync email).
 * Refresh on focus, no polling. Soglie rosso: pending >100, sync >24h.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Activity, AlertTriangle, Pause, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";


import { createLogger } from "@/lib/log";
const log = createLogger("SystemDiagnosticsBadge");
interface DiagnosticsPayload {
  agent_tasks_pending: number;
  email_queue_pending: number;
  extension_pending: number;
  cron_active: number;
  last_email_sync: string | null;
  generated_at: string;
}

async function fetchDiagnostics(): Promise<DiagnosticsPayload | null> {
  const { data, error } = await supabase.rpc("get_system_diagnostics" as never);
  if (error) {
    log.warn("[SystemDiagnosticsBadge] rpc error:", { error: error.message });
    return null;
  }
  return data as unknown as DiagnosticsPayload;
}

async function fetchPaused(): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_system_paused" as never);
  if (error) return false;
  return Boolean(data);
}

async function fetchInboundCounts(): Promise<{ total: number; orphans: number }> {
  const { data, error } = await supabase.rpc("count_inbound_activities" as never);
  if (error || !data) return { total: 0, orphans: 0 };
  const d = data as { total: number; orphans: number };
  return { total: d.total ?? 0, orphans: d.orphans ?? 0 };
}

function formatRelative(ts: string | null): string {
  if (!ts) return "mai";
  const diffMs = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ora";
  if (min < 60) return `${min}m fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
}

function isSyncStale(ts: string | null): boolean {
  if (!ts) return true;
  return Date.now() - new Date(ts).getTime() > 24 * 60 * 60 * 1000;
}

export function SystemDiagnosticsBadge() {
  const { isAdmin } = useAuthV2();
  const [open, setOpen] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["system-diagnostics"],
    queryFn: fetchDiagnostics,
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  const { data: paused = false } = useQuery({
    queryKey: ["system-paused"],
    queryFn: fetchPaused,
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const { data: inboundCounts } = useQuery({
    queryKey: ["inbound-activity-counts"],
    queryFn: fetchInboundCounts,
    enabled: isAdmin && pauseDialogOpen,
  });

  const togglePause = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.rpc("set_system_paused" as never, { p_paused: next } as never);
      if (error) throw error;
    },
    onSuccess: (_, next) => {
      qc.invalidateQueries({ queryKey: ["system-paused"] });
      qc.invalidateQueries({ queryKey: ["system-diagnostics"] });
      toast.success(next ? "Sistema in pausa" : "Sistema riattivato");
    },
    onError: (e: Error) => toast.error(`Errore: ${e.message}`),
  });

  const purge = useMutation({
    mutationFn: async (onlyOrphans: boolean) => {
      const { data: res, error } = await supabase.rpc("purge_inbound_activities" as never, { p_only_orphans: onlyOrphans } as never);
      if (error) throw error;
      return res as { deleted: number };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["inbound-activity-counts"] });
      qc.invalidateQueries();
      toast.success(`${res?.deleted ?? 0} attività eliminate`);
    },
    onError: (e: Error) => toast.error(`Errore pulizia: ${e.message}`),
  });

  if (!isAdmin) return null;

  const hasAlert =
    !!data &&
    (data.agent_tasks_pending > 100 ||
      data.email_queue_pending > 100 ||
      data.extension_pending > 100 ||
      isSyncStale(data.last_email_sync));

  const StatRow = ({
    label,
    value,
    danger,
  }: {
    label: string;
    value: string | number;
    danger?: boolean;
  }) => (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono font-medium",
          danger ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refetch();
        }}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
        aria-label="Diagnostica sistema"
      >
        {hasAlert ? (
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
        ) : paused ? (
          <Pause className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
        )}
        <span>Diagnostica</span>
        {paused && (
          <span className="font-mono text-[10px] uppercase font-bold text-amber-500">PAUSA</span>
        )}
        {data && (
          <span className="font-mono text-[10px] opacity-70">
            {data.agent_tasks_pending +
              data.email_queue_pending +
              data.extension_pending}{" "}
            pending
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-3 w-3 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-border/60 p-2.5">
          {/* Pausa Sistema */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/30 p-2">
            <div className="flex items-center gap-2 min-w-0">
              {paused ? (
                <Pause className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <Play className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold">Pausa Sistema</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {paused ? "Sync e classificazione FERMI" : "Sync IMAP + classificazione attivi"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {togglePause.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <Switch
                checked={paused}
                disabled={togglePause.isPending}
                onCheckedChange={(next) => {
                  if (next) {
                    setPauseDialogOpen(true);
                  } else {
                    togglePause.mutate(false);
                  }
                }}
                aria-label="Toggle pausa sistema"
              />
            </div>
          </div>

          {isLoading && !data && (
            <div className="text-xs text-muted-foreground">Caricamento…</div>
          )}
          {!isLoading && !data && (
            <div className="text-xs text-destructive">
              RPC non disponibile.
            </div>
          )}
          {data && (
            <>
              <StatRow
                label="Agent tasks pending"
                value={data.agent_tasks_pending}
                danger={data.agent_tasks_pending > 100}
              />
              <StatRow
                label="Email queue pending"
                value={data.email_queue_pending}
                danger={data.email_queue_pending > 100}
              />
              <StatRow
                label="Extension queue pending"
                value={data.extension_pending}
                danger={data.extension_pending > 100}
              />
              <StatRow label="Cron job attivi" value={data.cron_active} />
              <StatRow
                label="Ultima sync email"
                value={formatRelative(data.last_email_sync)}
                danger={isSyncStale(data.last_email_sync)}
              />
              <div className="pt-1 text-[10px] text-muted-foreground/60">
                Aggiornato {formatRelative(data.generated_at)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Dialog conferma pausa + cleanup */}
      <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-amber-500" />
              Mettere il sistema in pausa?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Verranno fermati: i due cron di sync IMAP (ogni 3 e 5 min) e il trigger che crea
                attività di follow-up dalle email in arrivo.
              </span>
              {inboundCounts && inboundCounts.total > 0 && (
                <span className="block rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-foreground">
                  Hai <strong>{inboundCounts.total}</strong> attività "Reply received" in coda
                  {inboundCounts.orphans > 0 && (
                    <> di cui <strong>{inboundCounts.orphans}</strong> senza partner reale collegato (probabile spam/newsletter)</>
                  )}
                  . Vuoi azzerarle ora?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            {inboundCounts && inboundCounts.orphans > 0 && (
              <Button
                variant="outline"
                disabled={purge.isPending || togglePause.isPending}
                onClick={async () => {
                  await purge.mutateAsync(true);
                  await togglePause.mutateAsync(true);
                  setPauseDialogOpen(false);
                }}
              >
                Pulisci solo spam + pausa
              </Button>
            )}
            {inboundCounts && inboundCounts.total > 0 && (
              <Button
                variant="destructive"
                disabled={purge.isPending || togglePause.isPending}
                onClick={async () => {
                  await purge.mutateAsync(false);
                  await togglePause.mutateAsync(true);
                  setPauseDialogOpen(false);
                }}
              >
                Pulisci tutte + pausa
              </Button>
            )}
            <AlertDialogAction
              disabled={togglePause.isPending}
              onClick={async () => {
                await togglePause.mutateAsync(true);
                setPauseDialogOpen(false);
              }}
            >
              Solo pausa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
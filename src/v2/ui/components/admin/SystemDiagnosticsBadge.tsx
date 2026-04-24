/**
 * SystemDiagnosticsBadge — P3.9
 * Mostra un piccolo badge admin-only con stato sistema in tempo reale.
 * Click → expand con dettagli (queue counts, cron, ultima sync email).
 * Refresh on focus, no polling. Soglie rosso: pending >100, sync >24h.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { cn } from "@/lib/utils";

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
    console.warn("[SystemDiagnosticsBadge] rpc error:", error.message);
    return null;
  }
  return data as unknown as DiagnosticsPayload;
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["system-diagnostics"],
    queryFn: fetchDiagnostics,
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
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
        ) : (
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
        )}
        <span>Diagnostica</span>
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
    </div>
  );
}
/**
 * SuperMarioTab — Toggle attivazione + osservatorio invocazioni.
 *
 * - Switch: attiva/disattiva Super Mario nel Command (localStorage).
 * - Tabella: ultime 20 invocazioni da super_mario_invocations.
 *   Mostra trace_id, scope, latency, tool calls, errori.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Rocket, RefreshCw, Brain, AlertCircle, CheckCircle2 } from "lucide-react";
import { isSuperMarioEnabled, setSuperMarioEnabled } from "@/v2/ai/superMarioFlag";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface InvocationRow {
  id: string;
  trace_id: string;
  scope: string;
  model: string;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  tool_calls_json: unknown;
  audit_warnings: unknown;
  error_code: string | null;
  created_at: string;
  response_summary: string | null;
}

async function fetchInvocations(): Promise<InvocationRow[]> {
  const { data, error } = await supabase
    .from("super_mario_invocations" as never)
    .select(
      "id, trace_id, scope, model, latency_ms, prompt_tokens, completion_tokens, tool_calls_json, audit_warnings, error_code, created_at, response_summary",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as InvocationRow[];
}

export function SuperMarioTab() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isSuperMarioEnabled());
  }, []);

  const { data: invocations, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["super-mario-invocations"],
    queryFn: fetchInvocations,
    refetchInterval: 10_000,
  });

  const stats = useMemo(() => {
    const list = invocations ?? [];
    const total = list.length;
    const errors = list.filter((r) => r.error_code).length;
    const avgLatency = total > 0
      ? Math.round(list.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / total)
      : 0;
    const totalTokens = list.reduce(
      (sum, r) => sum + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0),
      0,
    );
    return { total, errors, avgLatency, totalTokens };
  }, [invocations]);

  const onToggle = (next: boolean) => {
    setSuperMarioEnabled(next);
    setEnabled(next);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Super Mario — AI Gateway unificato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="font-medium">Attiva nel Command</div>
              <div className="text-sm text-muted-foreground">
                Quando attivo, il Command bypassa planner classico e regex e usa
                super-mario edge: identità DB + KB filtrata + memoria narrativa +
                hard guards + audit redatto.
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={onToggle} />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Invocazioni recenti" value={String(stats.total)} />
            <StatCard label="Errori" value={String(stats.errors)} tone={stats.errors > 0 ? "warn" : "ok"} />
            <StatCard label="Latenza media" value={`${stats.avgLatency}ms`} />
            <StatCard label="Token totali" value={stats.totalTokens.toLocaleString("it-IT")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Ultime invocazioni
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !invocations || invocations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nessuna invocazione registrata.
            </div>
          ) : (
            <ScrollArea className="h-[480px] pr-3">
              <div className="space-y-2">
                {invocations.map((row) => (
                  <InvocationRowView key={row.id} row={row} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${tone === "warn" ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function InvocationRowView({ row }: { row: InvocationRow }) {
  const toolCalls = Array.isArray(row.tool_calls_json) ? row.tool_calls_json : [];
  const audit = (row.audit_warnings ?? {}) as Record<string, unknown>;
  const domain = typeof audit.domain === "string" ? audit.domain : "—";
  const ok = !row.error_code;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {ok ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          <code className="text-xs">{row.trace_id.slice(0, 8)}</code>
          <Badge variant="outline" className="text-xs">{row.scope}</Badge>
          <Badge variant="secondary" className="text-xs">{domain}</Badge>
          <span className="text-xs text-muted-foreground">{row.model}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: it })}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{row.latency_ms ?? 0}ms</span>
        <span>·</span>
        <span>{(row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0)} tok</span>
        <span>·</span>
        <span>{toolCalls.length} tool</span>
        {row.error_code && (
          <>
            <span>·</span>
            <span className="text-destructive">{row.error_code}</span>
          </>
        )}
      </div>
      {row.response_summary && (
        <div className="text-xs text-muted-foreground line-clamp-2">
          {row.response_summary}
        </div>
      )}
    </div>
  );
}

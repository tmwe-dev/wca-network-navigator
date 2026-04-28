/**
 * AuditTab — Prompt Lab audit screen.
 *
 * For each active agent shows what is controlled from the Prompt Lab (DB)
 * versus what is hardcoded in code, with a clear diff view per:
 *   - persona, capabilities, operative prompts, tool registry, system prompt sections.
 *
 * Read-only. No mutations. The page is the cognitive map operators need to
 * understand WHERE to change behavior (Prompt Lab vs PR to code).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAgentAudit, type AgentAuditEntry } from "@/data/agentAudit";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Database, Code2, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type Source = "db" | "code" | "code+db" | "runtime" | string;

function SourceBadge({ source }: { source: Source }) {
  if (source.startsWith("db")) {
    return (
      <Badge variant="default" className="gap-1">
        <Database className="h-3 w-3" /> DB · Prompt Lab
      </Badge>
    );
  }
  if (source === "code+db") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Code2 className="h-3 w-3" /> Code + DB
      </Badge>
    );
  }
  if (source.startsWith("code")) {
    return (
      <Badge variant="outline" className="gap-1">
        <Code2 className="h-3 w-3" /> Hardcoded
      </Badge>
    );
  }
  return <Badge variant="outline">{source}</Badge>;
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (Array.isArray(value)) return value.length === 0 ? "[]" : JSON.stringify(value);
  return JSON.stringify(value);
}

function AgentAuditCard({ entry }: { entry: AgentAuditEntry }) {
  const overriddenCount = entry.capabilities.diff.filter((d) => d.overridden).length;
  const blockedTools = entry.tools.rows.filter((t) => !t.effective).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span aria-hidden>{entry.agent.avatar ?? "🤖"}</span>
              {entry.agent.name}
              <span className="text-xs font-normal text-muted-foreground">· {entry.agent.role}</span>
            </CardTitle>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={entry.persona.db_loaded ? "default" : "outline"} className="gap-1">
              Persona: {entry.persona.db_loaded ? "DB" : "code default"}
            </Badge>
            <Badge variant={entry.capabilities.db_loaded ? "default" : "outline"} className="gap-1">
              Capabilities: {entry.capabilities.db_loaded ? `DB (${overriddenCount} override)` : "code default"}
            </Badge>
            <Badge variant={entry.operative_prompts.loaded_count > 0 ? "default" : "outline"} className="gap-1">
              Operative: {entry.operative_prompts.loaded_count} caricati
            </Badge>
            <Badge variant={blockedTools > 0 ? "secondary" : "outline"}>
              Tool: {entry.tools.effective_count}/{entry.tools.total_count}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Prompt sections */}
        <section>
          <h3 className="text-sm font-semibold mb-2">System Prompt — composizione</h3>
          <div className="rounded-md border divide-y">
            {entry.system_prompt.sections.map((s) => (
              <div key={s.id} className="grid grid-cols-[200px_140px_1fr] gap-3 px-3 py-2 text-sm items-center">
                <code className="text-xs">{s.id}</code>
                <SourceBadge source={s.source} />
                <span className="text-muted-foreground text-xs">{s.note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities diff */}
        <section>
          <h3 className="text-sm font-semibold mb-2">
            Capabilities — DB vs Code default
          </h3>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Campo</th>
                  <th className="text-left px-3 py-2">Default (codice)</th>
                  <th className="text-left px-3 py-2">Valore DB (Prompt Lab)</th>
                  <th className="text-left px-3 py-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {entry.capabilities.diff.map((row) => (
                  <tr key={row.field} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{row.field}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs max-w-[240px] truncate">
                      {fmt(row.hardcoded_default)}
                    </td>
                    <td className={`px-3 py-2 text-xs max-w-[240px] truncate ${row.overridden ? "font-medium text-primary" : "text-muted-foreground"}`}>
                      {fmt(row.db_value)}
                    </td>
                    <td className="px-3 py-2">
                      {row.overridden ? (
                        <Badge variant="default" className="gap-1">
                          <Database className="h-3 w-3" /> Override DB
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Code2 className="h-3 w-3" /> Default
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tool registry */}
        <section>
          <h3 className="text-sm font-semibold mb-2">
            Tool registry — registro hardcoded, filtri DB
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Sorgente registro: <code>{entry.tools.registry_source}</code> · execution_mode:{" "}
            <code>{entry.tools.execution_mode}</code>
          </p>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Tool</th>
                  <th className="text-center px-3 py-2">Allowed (DB)</th>
                  <th className="text-center px-3 py-2">Blocked (DB)</th>
                  <th className="text-center px-3 py-2">Effettivo</th>
                  <th className="text-center px-3 py-2">Approvazione</th>
                  <th className="text-left px-3 py-2">Controllato da</th>
                </tr>
              </thead>
              <tbody>
                {entry.tools.rows.map((t) => (
                  <tr key={t.name} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{t.name}</td>
                    <td className="px-3 py-2 text-center">
                      {t.in_allowed_list ? (
                        <CheckCircle2 className="inline h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="inline h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {t.in_blocked_list ? (
                        <XCircle className="inline h-4 w-4 text-destructive" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {t.effective ? (
                        <Badge variant="default" className="text-[10px]">attivo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">filtrato</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {t.approval_hardcoded ? (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <ShieldCheck className="h-3 w-3" /> Hardcoded
                        </Badge>
                      ) : t.approval_added_by_db ? (
                        <Badge variant="default" className="text-[10px] gap-1">
                          <Database className="h-3 w-3" /> DB
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <SourceBadge source={t.controlled_by} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Operative prompts */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Prompt operativi (DB)</h3>
          {entry.operative_prompts.loaded_count === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {entry.operative_prompts.hardcoded_fallback}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-wrap gap-1">
              {entry.operative_prompts.applied.map((name) => (
                <Badge key={name} variant="outline" className="text-[11px]">{name}</Badge>
              ))}
              {entry.operative_prompts.has_mandatory && (
                <Badge variant="default" className="text-[11px]">obbligatori presenti</Badge>
              )}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export function AuditTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.agents.audit(),
    queryFn: fetchAgentAudit,
    staleTime: 30_000,
  });

  const [filter, setFilter] = useState<"all" | "overridden">("all");

  const filteredAgents = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.agents;
    return data.agents.filter(
      (a) => a.capabilities.db_loaded || a.persona.db_loaded || a.operative_prompts.loaded_count > 0,
    );
  }, [data, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Audit — Prompt Lab vs Code</h2>
          <p className="text-sm text-muted-foreground">
            Mappa per ogni agente cosa è governato dal DB (editabile da Prompt Lab) e cosa è
            hardcoded nel codice. Le hard-guards di sicurezza sono sempre nel codice.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            Tutti
          </Button>
          <Button
            size="sm"
            variant={filter === "overridden" ? "default" : "outline"}
            onClick={() => setFilter("overridden")}
          >
            Solo con override DB
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Hard guards card always on top */}
      {data && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-destructive" />
              Hard guards — non modificabili
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-xs text-muted-foreground">
              Sorgente: <code>{data.hard_guards.source}</code> · {data.hard_guards.note}
            </p>
            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-medium mb-1">Tabelle vietate</div>
                <div className="flex flex-wrap gap-1">
                  {data.hard_guards.forbidden_tables.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">Operazioni distruttive bloccate</div>
                <div className="flex flex-wrap gap-1">
                  {data.hard_guards.destructive_blocked.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">Approvazione sempre richiesta</div>
                <div className="flex flex-wrap gap-1">
                  {data.hard_guards.approval_always_required.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">Bulk caps</div>
                <div className="text-muted-foreground">
                  default: {data.hard_guards.bulk_caps.default} · hard max:{" "}
                  {data.hard_guards.bulk_caps.hard_max}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : "Errore nel caricamento dell'audit"}
          </AlertDescription>
        </Alert>
      )}

      <ScrollArea className="max-h-[calc(100vh-360px)]">
        <div className="space-y-4 pr-2">
          {filteredAgents.map((entry) => (
            <AgentAuditCard key={entry.agent.id} entry={entry} />
          ))}
          {data && filteredAgents.length === 0 && (
            <Alert>
              <AlertDescription>Nessun agente corrisponde al filtro.</AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default AuditTab;
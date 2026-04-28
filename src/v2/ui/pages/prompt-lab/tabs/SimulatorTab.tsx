/**
 * SimulatorTab — Prompt Lab simulator (read-only).
 *
 * Dato un agente + un messaggio utente, mostra ESATTAMENTE:
 *  - System prompt assemblato (stesso identico ad agent-loop)
 *  - Persona caricata dal DB
 *  - Capabilities (tool whitelist, timeout, modello…)
 *  - Prompt operativi caricati dal Prompt Lab (con nomi e match)
 *  - Hard guards che si applicano sempre
 *  - (Opzionale) Dry-run AI: chiama il modello e mostra i tool_calls proposti
 *    SENZA eseguirli, con flag "would_be_blocked / would_require_approval".
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Loader2, Play, FlaskConical, ShieldCheck, Wrench, FileText, Sparkles,
  AlertTriangle, CheckCircle2, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { listAgentsForCapabilities } from "@/data/agentsForPromptLab";
import { runAgentSimulator, type SimulatorResponse } from "@/data/agentSimulator";
import { queryKeys } from "@/lib/queryKeys";

export function SimulatorTab() {
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.allForCapabilities(),
    queryFn: listAgentsForCapabilities,
    staleTime: 60_000,
  });

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [userMessage, setUserMessage] = useState<string>(
    "Cerca Luca Arcanà di Transport Management Srl e prepara un messaggio di follow-up.",
  );
  const [dryRunAI, setDryRunAI] = useState(false);

  useEffect(() => {
    if (!selectedAgentId && agentsQuery.data?.length) {
      setSelectedAgentId(agentsQuery.data[0].id);
    }
  }, [agentsQuery.data, selectedAgentId]);

  const sim = useMutation({
    mutationFn: () =>
      runAgentSimulator({
        agentId: selectedAgentId || null,
        userMessage,
        dryRunAI,
      }),
    onError: (e: Error) => toast.error(`Simulazione fallita: ${e.message}`),
  });

  const result: SimulatorResponse | undefined = sim.data;

  const selectedAgent = useMemo(
    () => agentsQuery.data?.find((a) => a.id === selectedAgentId) ?? null,
    [agentsQuery.data, selectedAgentId],
  );

  return (
    <div className="flex flex-col gap-3 h-full overflow-auto pr-1">
      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Simulatore agente</h3>
          <Badge variant="outline" className="text-[10px]">read-only</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <Label className="text-xs">Agente</Label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Seleziona agente" /></SelectTrigger>
              <SelectContent>
                {agentsQuery.data?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.avatar_emoji} {a.name} <span className="text-muted-foreground">· {a.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAgent && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Simulazione per <strong>{selectedAgent.name}</strong>. Nessun tool verrà eseguito.
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Messaggio utente / obiettivo</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Es. Trova partner in Brasile interessati a air freight e proponi un meeting."
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch checked={dryRunAI} onCheckedChange={setDryRunAI} />
            <span>
              <strong>Dry-run AI</strong> — chiama il modello e mostra i tool_calls proposti
              (nessuna esecuzione)
            </span>
          </label>
          <Button
            onClick={() => sim.mutate()}
            disabled={!userMessage.trim() || sim.isPending}
            size="sm"
            className="gap-2"
          >
            {sim.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Play className="h-3.5 w-3.5" />}
            Simula
          </Button>
        </div>
      </Card>

      {!result && !sim.isPending && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Seleziona un agente, scrivi un messaggio e premi <strong>Simula</strong> per vedere
          come verrebbe assemblato il prompt prima di eseguire qualsiasi flusso reale.
        </Card>
      )}

      {result && (
        <>
          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">System prompt assemblato</h3>
              <Badge variant="outline" className="text-[10px]">
                {result.assembled.char_count.toLocaleString("it-IT")} char
              </Badge>
            </div>
            <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 max-h-72 overflow-auto whitespace-pre-wrap">
              {result.assembled.system_prompt}
            </pre>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Persona</h3>
                {result.persona.loaded
                  ? <Badge className="text-[10px] bg-emerald-600">caricata</Badge>
                  : <Badge variant="outline" className="text-[10px]">default</Badge>}
              </div>
              {result.persona.loaded ? (
                <div className="text-xs space-y-1">
                  <div><span className="text-muted-foreground">Tono:</span> {result.persona.tone}</div>
                  <div><span className="text-muted-foreground">Lingua:</span> {result.persona.language}</div>
                  <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap mt-1">
                    {result.persona.block_preview}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{result.persona.note}</p>
              )}
            </Card>

            <Card className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Capabilities</h3>
                {result.capabilities.loaded
                  ? <Badge className="text-[10px] bg-emerald-600">DB</Badge>
                  : <Badge variant="outline" className="text-[10px]">default</Badge>}
              </div>
              <div className="text-xs grid grid-cols-2 gap-1.5">
                <div><span className="text-muted-foreground">Modalità:</span> {result.capabilities.execution_mode}</div>
                <div><span className="text-muted-foreground">Modello:</span> {result.capabilities.preferred_model ?? "default"}</div>
                <div><span className="text-muted-foreground">Temp:</span> {result.capabilities.temperature}</div>
                <div><span className="text-muted-foreground">Max tokens:</span> {result.capabilities.max_tokens_per_call}</div>
                <div><span className="text-muted-foreground">Iter max:</span> {result.capabilities.max_iterations}</div>
                <div><span className="text-muted-foreground">Concorrenza:</span> {result.capabilities.max_concurrent_tools}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Timeout step:</span> {result.capabilities.step_timeout_ms} ms</div>
              </div>
            </Card>
          </div>

          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Tool whitelist effettiva</h3>
              <Badge variant="outline" className="text-[10px]">
                {result.tools.effective.length}/{result.tools.all_registered.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {result.tools.approval_map.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded border text-xs"
                >
                  <span className="font-mono truncate">{t.name}</span>
                  {t.requires_approval && (
                    <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-600">
                      approva
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            {result.tools.filtered_out.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-1">
                  <Ban className="h-3 w-3 text-destructive" />
                  <span className="text-[11px] text-muted-foreground">Filtrati fuori:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.tools.filtered_out.map((n) => (
                    <Badge key={n} variant="outline" className="text-[10px] line-through opacity-60">{n}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Prompt operativi (Prompt Lab)</h3>
              <Badge variant="outline" className="text-[10px]">
                {result.operative_prompts.applied.length} applicati
              </Badge>
              {result.operative_prompts.has_mandatory && (
                <Badge className="text-[10px] bg-amber-600">OBBLIGATORIA presente</Badge>
              )}
            </div>
            {result.operative_prompts.applied.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nessun prompt operativo matchato per scope <code>agent-loop</code>.
              </p>
            ) : (
              <ul className="text-xs space-y-0.5">
                {result.operative_prompts.applied.map((n) => (
                  <li key={n} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-[11px] text-muted-foreground pt-1 border-t">
              Match: contexts <code>{result.operative_prompts.matched.contexts.join(", ") || "—"}</code>{" · "}
              tags <code>{result.operative_prompts.matched.tags.join(", ") || "—"}</code>
            </div>
            {result.operative_prompts.block_preview && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Mostra blocco testo
                </summary>
                <pre className="font-mono bg-muted/40 rounded p-2 max-h-60 overflow-auto whitespace-pre-wrap mt-1">
                  {result.operative_prompts.block_preview}
                </pre>
              </details>
            )}
          </Card>

          <Card className="p-3 space-y-2 border-amber-500/40">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold">Hard guards (sempre attivi)</h3>
            </div>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Tabelle vietate: </span>
                {result.hard_guards.forbidden_tables.map((t) => (
                  <code key={t} className="mx-0.5 px-1 rounded bg-muted">{t}</code>
                ))}
              </div>
              <div>
                <span className="text-muted-foreground">Op distruttive: </span>
                {result.hard_guards.destructive_ops_blocked.join(" · ")}
              </div>
              <div>
                <span className="text-muted-foreground">Bulk caps: </span>
                {Object.entries(result.hard_guards.bulk_caps).map(([k, v]) => `${k}=${v}`).join(", ")}
              </div>
              <div>
                <span className="text-muted-foreground">Approvazione obbligatoria: </span>
                {result.hard_guards.approval_required_always.join(", ")}
              </div>
              <p className="text-[11px] italic text-muted-foreground pt-1">{result.hard_guards.notes}</p>
            </div>
          </Card>

          {result.dry_run && (
            <Card className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Dry-run AI</h3>
                {result.dry_run.model && (
                  <Badge variant="outline" className="text-[10px]">{result.dry_run.model}</Badge>
                )}
                {typeof result.dry_run.elapsed_ms === "number" && (
                  <Badge variant="outline" className="text-[10px]">
                    {result.dry_run.elapsed_ms} ms
                  </Badge>
                )}
              </div>
              {result.dry_run.error ? (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div>{result.dry_run.error}</div>
                    {result.dry_run.detail && (
                      <pre className="font-mono bg-muted/40 rounded p-2 mt-1 whitespace-pre-wrap">
                        {result.dry_run.detail}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {result.dry_run.message && (
                    <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 whitespace-pre-wrap">
                      {result.dry_run.message}
                    </pre>
                  )}
                  <div className="text-xs">
                    <div className="font-medium mb-1">Tool proposti dal modello (NON eseguiti):</div>
                    {(result.dry_run.proposed_tool_calls ?? []).length === 0 ? (
                      <p className="text-muted-foreground">Nessun tool_call proposto.</p>
                    ) : (
                      <ul className="space-y-1">
                        {result.dry_run.proposed_tool_calls!.map((tc, i) => (
                          <li
                            key={i}
                            className={`p-2 rounded border text-[11px] font-mono ${
                              tc.would_be_blocked
                                ? "border-destructive bg-destructive/5"
                                : tc.would_require_approval
                                ? "border-amber-500 bg-amber-500/5"
                                : "border-border"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold">{tc.name}</span>
                              {tc.would_be_blocked && (
                                <Badge variant="destructive" className="text-[9px]">bloccato</Badge>
                              )}
                              {tc.would_require_approval && !tc.would_be_blocked && (
                                <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-600">
                                  richiede approvazione
                                </Badge>
                              )}
                            </div>
                            <pre className="text-[10px] whitespace-pre-wrap">
                              {JSON.stringify(tc.arguments, null, 2)}
                            </pre>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
/**
 * PromptTestsTab — Suite di test di regressione per i prompt operativi.
 *
 * Permette di:
 *  - Selezionare un operative prompt
 *  - Visualizzare/CRUD i test cases (input_payload + assertion)
 *  - Eseguire i test via edge function `prompt-test-runner`
 *  - Visualizzare l'esito dei run più recenti (passed/failed/error)
 *
 * Layout: 3 colonne (prompt list • test cases • dettaglio + esiti).
 * Logic-less: tutta la business logic è in DAL (`@/data/promptTests`).
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { findOperativePrompts } from "@/data/operativePrompts";
import {
  listTestCasesForPrompt,
  listRunsForPrompt,
  upsertTestCase,
  deleteTestCase,
  runTests,
  type PromptTestCase,
  type PromptTestRun,
} from "@/data/promptTests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Play, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle, History, Building2, Languages, BookOpen, ChevronRight } from "lucide-react";

interface PromptOption { id: string; name: string }

const QK_PROMPTS = ["prompt-tests", "prompts-list"] as const;
const qkCases = (promptId: string) => ["prompt-tests", "cases", promptId] as const;
const qkRuns = (promptId: string) => ["prompt-tests", "runs", promptId] as const;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning dark:text-warning border-warning/30",
  info: "bg-info/15 text-info border-info/30",
};

const STATUS_ICON: Record<string, ReactNode> = {
  passed: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  failed: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  error: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
  skipped: <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />,
};

function emptyDraft(promptId: string): Partial<PromptTestCase> {
  return {
    prompt_id: promptId,
    name: "Nuovo test case",
    description: "",
    input_payload: {},
    expected_contains: [],
    expected_not_contains: [],
    expected_regex: null,
    severity: "warning",
    is_active: true,
    temperature: 0.3,
    model: null,
  };
}

export function PromptTestsTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PromptTestCase> | null>(null);
  const [payloadText, setPayloadText] = useState<string>("{}");
  const [containsText, setContainsText] = useState<string>("");
  const [notContainsText, setNotContainsText] = useState<string>("");

  // ── Queries ──
  const promptsQuery = useQuery({
    queryKey: [...QK_PROMPTS, userId],
    enabled: !!userId,
    queryFn: async () => {
      const rows = await findOperativePrompts(userId, "id, name");
      return rows as unknown as PromptOption[];
    },
  });

  const casesQuery = useQuery({
    queryKey: selectedPromptId ? qkCases(selectedPromptId) : ["prompt-tests", "cases", "none"],
    enabled: !!selectedPromptId,
    queryFn: () => listTestCasesForPrompt(selectedPromptId!),
  });

  const runsQuery = useQuery({
    queryKey: selectedPromptId ? qkRuns(selectedPromptId) : ["prompt-tests", "runs", "none"],
    enabled: !!selectedPromptId,
    queryFn: () => listRunsForPrompt(selectedPromptId!, 30),
  });

  // Auto-select first prompt
  useEffect(() => {
    if (!selectedPromptId && promptsQuery.data && promptsQuery.data.length > 0) {
      setSelectedPromptId(promptsQuery.data[0].id);
    }
  }, [promptsQuery.data, selectedPromptId]);

  // Sync draft when selecting case
  useEffect(() => {
    const cases = casesQuery.data ?? [];
    const found = cases.find((c) => c.id === selectedCaseId);
    if (found) {
      setDraft(found);
      setPayloadText(JSON.stringify(found.input_payload ?? {}, null, 2));
      setContainsText((found.expected_contains ?? []).join("\n"));
      setNotContainsText((found.expected_not_contains ?? []).join("\n"));
    } else if (selectedCaseId === "__new__" && selectedPromptId) {
      const d = emptyDraft(selectedPromptId);
      setDraft(d);
      setPayloadText("{}");
      setContainsText("");
      setNotContainsText("");
    }
  }, [selectedCaseId, casesQuery.data, selectedPromptId]);

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !selectedPromptId) throw new Error("Nessun draft");
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(payloadText || "{}");
      } catch {
        throw new Error("input_payload non è JSON valido");
      }
      const expContains = containsText.split("\n").map((s) => s.trim()).filter(Boolean);
      const expNot = notContainsText.split("\n").map((s) => s.trim()).filter(Boolean);

      return upsertTestCase({
        id: draft.id,
        prompt_id: selectedPromptId,
        name: draft.name || "Test case",
        description: draft.description ?? null,
        input_payload: payload,
        expected_contains: expContains,
        expected_not_contains: expNot,
        expected_regex: draft.expected_regex || null,
        model: draft.model || null,
        temperature: draft.temperature ?? 0.3,
        severity: (draft.severity as PromptTestCase["severity"]) ?? "warning",
        is_active: draft.is_active ?? true,
      });
    },
    onSuccess: (saved) => {
      toast.success("Test case salvato");
      if (selectedPromptId) qc.invalidateQueries({ queryKey: qkCases(selectedPromptId) });
      setSelectedCaseId(saved.id);
    },
    onError: (e) => toast.error(`Errore salvataggio: ${(e as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteTestCase(id);
    },
    onSuccess: () => {
      toast.success("Test case eliminato");
      if (selectedPromptId) qc.invalidateQueries({ queryKey: qkCases(selectedPromptId) });
      setSelectedCaseId(null);
      setDraft(null);
    },
    onError: (e) => toast.error(`Errore eliminazione: ${(e as Error).message}`),
  });

  const runOneMutation = useMutation({
    mutationFn: async (testCaseId: string) => runTests({ test_case_id: testCaseId }),
    onSuccess: (res) => {
      const r = res.runs?.[0];
      if (r) {
        if (r.status === "passed") toast.success("Test PASSATO");
        else if (r.status === "failed") toast.error(`Test FALLITO: ${r.failure_reasons.join("; ")}`);
        else toast.error(`Errore: ${r.failure_reasons.join("; ")}`);
      }
      if (selectedPromptId) qc.invalidateQueries({ queryKey: qkRuns(selectedPromptId) });
    },
    onError: (e) => toast.error(`Errore esecuzione: ${(e as Error).message}`),
  });

  const runAllMutation = useMutation({
    mutationFn: async () => runTests({ prompt_id: selectedPromptId! }),
    onSuccess: (res) => {
      const s = res.summary;
      if (s) {
        toast.success(`Run completato: ${s.passed}/${s.total} passati (${s.failed} failed, ${s.error} error)`);
      } else {
        toast.message(res.message ?? "Nessun test attivo");
      }
      if (selectedPromptId) qc.invalidateQueries({ queryKey: qkRuns(selectedPromptId) });
    },
    onError: (e) => toast.error(`Errore esecuzione: ${(e as Error).message}`),
  });

  const runsByCase = useMemo(() => {
    const map = new Map<string, PromptTestRun>();
    for (const r of runsQuery.data ?? []) {
      if (!map.has(r.test_case_id)) map.set(r.test_case_id, r); // first = most recent
    }
    return map;
  }, [runsQuery.data]);

  return (
    <div className="flex h-full min-h-0 gap-2">
      {/* COL 1: Prompt selector */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-2 border-r pr-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Prompt</Label>
          {promptsQuery.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {(promptsQuery.data ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPromptId(p.id);
                  setSelectedCaseId(null);
                  setDraft(null);
                }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  selectedPromptId === p.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                {p.name}
              </button>
            ))}
            {promptsQuery.data?.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2">Nessun operative prompt.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* COL 2: Test cases list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2 border-r pr-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Test cases</Label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              disabled={!selectedPromptId || runAllMutation.isPending}
              onClick={() => runAllMutation.mutate()}
            >
              {runAllMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Run all
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              disabled={!selectedPromptId}
              onClick={() => setSelectedCaseId("__new__")}
            >
              <Plus className="h-3 w-3" /> Nuovo
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {(casesQuery.data ?? []).map((tc) => {
              const lastRun = runsByCase.get(tc.id);
              return (
                <button
                  key={tc.id}
                  onClick={() => setSelectedCaseId(tc.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    selectedCaseId === tc.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {lastRun ? STATUS_ICON[lastRun.status] : <span className="h-3.5 w-3.5 inline-block" />}
                    <span className="flex-1 truncate">{tc.name}</span>
                    {!tc.is_active && <Badge variant="outline" className="text-[9px] py-0">off</Badge>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 ml-5">
                    <Badge variant="outline" className={`text-[9px] py-0 px-1 ${SEVERITY_COLORS[tc.severity]}`}>
                      {tc.severity}
                    </Badge>
                    {lastRun && (
                      <span className="text-[9px] text-muted-foreground">{lastRun.duration_ms}ms</span>
                    )}
                  </div>
                </button>
              );
            })}
            {casesQuery.data?.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2">Nessun test. Crea il primo.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* COL 3: Editor + last run */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
        {!draft && (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Seleziona un test case o creane uno nuovo.
          </div>
        )}
        {draft && (
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              <div className="flex items-center gap-2">
                <Input
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Nome test case"
                  className="h-8 text-sm font-medium"
                />
                <Switch
                  checked={draft.is_active ?? true}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />
                <span className="text-[10px] text-muted-foreground">attivo</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px]">Severity</Label>
                  <Select
                    value={(draft.severity as string) ?? "warning"}
                    onValueChange={(v) => setDraft({ ...draft, severity: v as PromptTestCase["severity"] })}
                  >
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">critical</SelectItem>
                      <SelectItem value="warning">warning</SelectItem>
                      <SelectItem value="info">info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Modello (opz.)</Label>
                  <Input
                    value={draft.model ?? ""}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value || null })}
                    placeholder="google/gemini-2.5-flash-lite"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={draft.temperature ?? 0.3}
                    onChange={(e) => setDraft({ ...draft, temperature: parseFloat(e.target.value) })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px]">Descrizione</Label>
                <Input
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Cosa verifica questo test"
                  className="h-7 text-xs"
                />
              </div>

              <div>
                <Label className="text-[10px]">Input payload (JSON)</Label>
                <Textarea
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  rows={6}
                  className="text-[11px] font-mono"
                  placeholder='{"contact": "...", "context": "..."}'
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Expected contains (1 per riga)</Label>
                  <Textarea
                    value={containsText}
                    onChange={(e) => setContainsText(e.target.value)}
                    rows={4}
                    className="text-[11px] font-mono"
                    placeholder="frase 1&#10;frase 2"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Expected NOT contains (1 per riga)</Label>
                  <Textarea
                    value={notContainsText}
                    onChange={(e) => setNotContainsText(e.target.value)}
                    rows={4}
                    className="text-[11px] font-mono"
                    placeholder="parola vietata"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px]">Expected regex (opz., flag i)</Label>
                <Input
                  value={draft.expected_regex ?? ""}
                  onChange={(e) => setDraft({ ...draft, expected_regex: e.target.value || null })}
                  placeholder="^subject:\\s+.{3,}"
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-7"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Salva
                </Button>
                {draft.id && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => runOneMutation.mutate(draft.id!)}
                      disabled={runOneMutation.isPending}
                    >
                      {runOneMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                      Esegui
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-destructive"
                      onClick={() => {
                        if (confirm("Eliminare questo test case?")) deleteMutation.mutate(draft.id!);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>

              {/* Last run details for selected case */}
              {draft.id && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-[10px] flex items-center gap-1">
                      <History className="h-3 w-3" /> Ultimi run di questo test
                    </Label>
                    <div className="space-y-1 mt-1">
                      {(runsQuery.data ?? [])
                        .filter((r) => r.test_case_id === draft.id)
                        .slice(0, 5)
                        .map((r) => (
                        <RunCard key={r.id} run={r} />
                        ))}
                      {(runsQuery.data ?? []).filter((r) => r.test_case_id === draft.id).length === 0 && (
                        <p className="text-[10px] text-muted-foreground">Nessun run ancora. Premi "Esegui".</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

/**
 * RunCard — Visualizzazione leggibile di un singolo run.
 * - Header con badge stato/lingua/modello/durata/token.
 * - Box "Identità iniettata" read-only (azienda, alias, contatto, lingua).
 * - Output AI sempre visibile, formattato leggibile (no mono, no max-h piccola).
 * - Sezione collassabile "Prompt costruito" (system prompt completo).
 * - Sezione "Check eseguiti" con ✅/❌ per assertion fallite.
 */
function RunCard({ run }: { run: PromptTestRun }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const meta = (run.metadata ?? {}) as Record<string, unknown>;
  const company = (meta.identity_company as string | null) ?? null;
  const companyAlias = (meta.identity_company_alias as string | null) ?? null;
  const contact = (meta.identity_contact as string | null) ?? null;
  const language = (meta.language_used as string | null) ?? null;
  const kbCount = (meta.kb_snippets_count as number | null) ?? null;
  const identityLoaded = meta.identity_loaded === true;
  const systemPrompt = (meta.system_prompt as string | null) ?? null;

  const statusBadge =
    run.status === "passed"
      ? "bg-success/15 text-success border-success/30"
      : run.status === "failed"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : run.status === "error"
      ? "bg-warning/15 text-warning border-warning/30"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div className="border rounded-md p-3 space-y-2 bg-card">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <Badge variant="outline" className={`${statusBadge} font-semibold uppercase`}>
          {STATUS_ICON[run.status]}
          <span className="ml-1">{run.status}</span>
        </Badge>
        {language && (
          <Badge variant="outline" className="gap-1">
            <Languages className="h-3 w-3" /> {language}
          </Badge>
        )}
        {run.model_used && <Badge variant="outline">{run.model_used}</Badge>}
        <Badge variant="outline">{run.duration_ms}ms</Badge>
        {(run.tokens_input ?? run.tokens_output) !== null && (
          <Badge variant="outline">
            tok {run.tokens_input ?? "?"}→{run.tokens_output ?? "?"}
          </Badge>
        )}
        {kbCount !== null && (
          <Badge variant="outline" className="gap-1">
            <BookOpen className="h-3 w-3" /> KB {kbCount}
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {new Date(run.created_at).toLocaleString()}
        </span>
      </div>

      {/* Identità iniettata */}
      <div
        className={`flex flex-wrap items-center gap-2 text-[11px] rounded px-2 py-1.5 border ${
          identityLoaded
            ? "bg-muted/40 border-border"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}
      >
        <Building2 className="h-3 w-3 shrink-0" />
        {identityLoaded ? (
          <>
            <span className="font-medium">{company || "—"}</span>
            {companyAlias && <span className="text-muted-foreground">({companyAlias})</span>}
            <span className="text-muted-foreground">·</span>
            <span>{contact || "—"}</span>
          </>
        ) : (
          <span className="font-medium">⚠️ Nessuna identità caricata (app_settings vuoto)</span>
        )}
      </div>

      {/* Failure reasons */}
      {run.failure_reasons.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">
            Check falliti
          </div>
          {run.failure_reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-destructive">
              <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="leading-relaxed">{reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI output — sempre visibile, leggibile */}
      {run.ai_output && (
        <div className="space-y-0.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">
            Output AI ({run.ai_output.length} ch)
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap rounded border bg-background/60 p-2.5 max-h-96 overflow-auto">
            {run.ai_output}
          </div>
        </div>
      )}

      {/* Prompt costruito (collapsible) */}
      {systemPrompt && (
        <div>
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform ${showPrompt ? "rotate-90" : ""}`}
            />
            Prompt costruito ({systemPrompt.length} ch)
          </button>
          {showPrompt && (
            <pre className="mt-1 p-2 bg-muted/50 rounded text-[10px] font-mono whitespace-pre-wrap max-h-72 overflow-auto">
              {systemPrompt}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
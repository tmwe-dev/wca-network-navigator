/**
 * PromptReaderPage — Lettore di tutti i prompt assemblati.
 *
 * Layout:
 *  - Sidebar a scomparsa (linguetta laterale) con tutti gli agenti raggruppati
 *    per categoria (riusa AGENT_REGISTRY).
 *  - Area centrale: per l'agente selezionato mostra in TESTO PIENO tutti i
 *    prompt che lo compongono, separati per sezione (system prompt assemblato,
 *    persona, operative prompts applicati, hard guards, tool effettivi).
 *
 * Sorgente dati: `runAgentSimulator` con `dryRunAI=false` (nessuna chiamata AI,
 * solo assemblaggio prompt). Cache per agente in memoria locale.
 *
 * UI logic-less rispetto al simulator: NON esegue tool, NON persiste nulla.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookText, ChevronLeft, ChevronRight, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AGENT_REGISTRY, type AgentRegistryEntry, type AgentCategory } from "@/data/agentPrompts";
import { runAgentSimulator, type SimulatorResponse } from "@/data/agentSimulator";

const CATEGORY_ORDER: AgentCategory[] = [
  "core", "email", "outreach", "analysis", "voice", "autonomous", "classifier",
];
const CATEGORY_LABEL: Record<AgentCategory, string> = {
  core: "Core",
  email: "Email",
  outreach: "Outreach",
  analysis: "Analisi",
  voice: "Voice",
  autonomous: "Autonomi",
  classifier: "Classificatori",
};

function copy(text: string, label = "Prompt") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiato`),
    () => toast.error("Copia fallita"),
  );
}

function Section({
  title,
  meta,
  children,
  onCopy,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  onCopy?: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary truncate">{title}</h3>
          {meta && <span className="text-[10px] text-muted-foreground truncate">{meta}</span>}
        </div>
        {onCopy && (
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" onClick={onCopy}>
            <Copy className="h-3 w-3" /> Copia
          </Button>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function PromptReaderPage() {
  const allAgents = useMemo(() => Object.values(AGENT_REGISTRY), []);
  const [selectedId, setSelectedId] = useState<string>(allAgents[0]?.id ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cache, setCache] = useState<Record<string, SimulatorResponse>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selected = allAgents.find((a) => a.id === selectedId) ?? allAgents[0];
  const data: SimulatorResponse | undefined = selected ? cache[selected.id] : undefined;

  const grouped = useMemo(() => {
    const m = new Map<AgentCategory, AgentRegistryEntry[]>();
    for (const a of allAgents) {
      if (!m.has(a.category)) m.set(a.category, []);
      m.get(a.category)!.push(a);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return m;
  }, [allAgents]);

  async function load(id: string, force = false) {
    if (!force && cache[id]) return;
    setLoadingId(id);
    setErrorMsg(null);
    try {
      const res = await runAgentSimulator({
        agentId: id,
        userMessage: "(lettura prompt — nessun input utente)",
        dryRunAI: false,
      });
      setCache((prev) => ({ ...prev, [id]: res }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    if (selected) void load(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild size="sm" variant="ghost" className="h-7 px-2">
            <Link to="/v2">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
            </Link>
          </Button>
          <span className="text-muted-foreground text-xs">/</span>
          <BookText className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold">Prompt Reader</h1>
          <span className="text-muted-foreground text-xs hidden md:inline truncate">
            — leggi in chiaro tutti i prompt assemblati di ciascun agente
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={() => selected && load(selected.id, true)}
          disabled={loadingId === selected?.id}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loadingId === selected?.id && "animate-spin")} />
          Ricarica
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar collassabile */}
        <aside
          className={cn(
            "border-r bg-muted/20 transition-all duration-200 flex flex-col overflow-hidden",
            sidebarOpen ? "w-64" : "w-0",
          )}
        >
          <nav className="flex-1 overflow-auto p-2 space-y-2">
            {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
              <div key={cat}>
                <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABEL[cat]}
                </div>
                <ul className="space-y-0.5">
                  {grouped.get(cat)!.map((a) => {
                    const active = a.id === selectedId;
                    return (
                      <li key={a.id}>
                        <button
                          onClick={() => setSelectedId(a.id)}
                          className={cn(
                            "w-full text-left rounded px-2 py-1.5 text-xs transition-colors truncate",
                            active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                          )}
                        >
                          {a.displayName}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Linguetta toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-10 h-16 w-5 rounded-r-md bg-primary/90 text-primary-foreground hover:bg-primary flex items-center justify-center shadow-md transition-all",
          )}
          style={{ left: sidebarOpen ? "16rem" : "0" }}
          title={sidebarOpen ? "Nascondi elenco" : "Mostra elenco"}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Contenuto: prompt in chiaro */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6 space-y-4">
            {selected && (
              <header className="border-b pb-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{selected.displayName}</h2>
                  <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[selected.category]}</Badge>
                  {selected.runtime.edgeFunction && (
                    <Badge variant="secondary" className="text-[10px] font-mono">{selected.runtime.edgeFunction}</Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] font-mono">{selected.runtime.modelDefault}</Badge>
                </div>
                {selected.description && (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{selected.description}</p>
                )}
              </header>
            )}

            {loadingId === selected?.id && !data && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Assemblaggio prompt in corso…
              </div>
            )}

            {errorMsg && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                Errore: {errorMsg}
              </div>
            )}

            {data && (
              <>
                {/* 1. System prompt assemblato (sorgente di verità) */}
                <Section
                  title="System prompt assemblato"
                  meta={`${data.assembled.char_count.toLocaleString("it-IT")} caratteri`}
                  onCopy={() => copy(data.assembled.system_prompt, "System prompt")}
                >
                  <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed font-mono bg-muted/40 rounded p-3 max-h-[600px] overflow-auto">
                    {data.assembled.system_prompt || "(vuoto)"}
                  </pre>
                </Section>

                {/* 2. Persona */}
                <Section
                  title="Persona"
                  meta={data.persona.loaded ? `tono: ${data.persona.tone ?? "—"} · lingua: ${data.persona.language ?? "—"}` : "non caricata"}
                  onCopy={data.persona.block_preview ? () => copy(data.persona.block_preview ?? "", "Persona") : undefined}
                >
                  {data.persona.loaded ? (
                    <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed bg-muted/40 rounded p-3">
                      {data.persona.block_preview || "(blocco persona vuoto)"}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">{data.persona.note || "Nessuna persona definita per questo agente."}</p>
                  )}
                </Section>

                {/* 3. Operative prompts applicati */}
                <Section
                  title="Prompt operativi applicati (Prompt Lab)"
                  meta={`${data.operative_prompts.applied.length} blocchi · contesti: ${data.operative_prompts.matched.contexts.join(", ") || "—"}`}
                  onCopy={data.operative_prompts.block_preview ? () => copy(data.operative_prompts.block_preview, "Operative prompts") : undefined}
                >
                  {data.operative_prompts.applied.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nessun prompt operativo applicato.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {data.operative_prompts.applied.map((n) => (
                          <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>
                        ))}
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed bg-muted/40 rounded p-3 max-h-[400px] overflow-auto">
                        {data.operative_prompts.block_preview || "(anteprima vuota)"}
                      </pre>
                    </>
                  )}
                </Section>

                {/* 4. Capabilities runtime */}
                <Section title="Capabilities runtime" meta={data.capabilities.loaded ? "caricate da DB" : "default"}>
                  <ul className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
                    <li><span className="text-muted-foreground">Modalità:</span> <span className="font-mono">{data.capabilities.execution_mode}</span></li>
                    <li><span className="text-muted-foreground">Modello:</span> <span className="font-mono">{data.capabilities.preferred_model ?? "—"}</span></li>
                    <li><span className="text-muted-foreground">Temperature:</span> <span className="font-mono">{data.capabilities.temperature}</span></li>
                    <li><span className="text-muted-foreground">Max token/call:</span> <span className="font-mono">{data.capabilities.max_tokens_per_call}</span></li>
                    <li><span className="text-muted-foreground">Max iterazioni:</span> <span className="font-mono">{data.capabilities.max_iterations}</span></li>
                    <li><span className="text-muted-foreground">Tool concorrenti:</span> <span className="font-mono">{data.capabilities.max_concurrent_tools}</span></li>
                  </ul>
                </Section>

                {/* 5. Tools */}
                <Section title="Tool effettivi" meta={`${data.tools.effective.length}/${data.tools.all_registered.length} consentiti`}>
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Consentiti</p>
                      <div className="flex flex-wrap gap-1">
                        {data.tools.effective.length === 0
                          ? <span className="text-muted-foreground italic text-[11px]">nessuno</span>
                          : data.tools.effective.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
                            ))}
                      </div>
                    </div>
                    {data.tools.filtered_out.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Filtrati dalle capabilities</p>
                        <div className="flex flex-wrap gap-1">
                          {data.tools.filtered_out.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] font-mono opacity-60">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>

                {/* 6. Hard guards */}
                <Section title="Hard guards (sempre attivi)">
                  <div className="text-xs space-y-2">
                    <div>
                      <span className="text-muted-foreground">Tabelle vietate: </span>
                      <span className="font-mono">{data.hard_guards.forbidden_tables.join(", ")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Operazioni distruttive bloccate: </span>
                      <span className="font-mono">{data.hard_guards.destructive_ops_blocked.join(", ")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Approvazione sempre richiesta: </span>
                      <span className="font-mono">{data.hard_guards.approval_required_always.join(", ")}</span>
                    </div>
                    <p className="text-[11px] italic text-muted-foreground">{data.hard_guards.notes}</p>
                  </div>
                </Section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
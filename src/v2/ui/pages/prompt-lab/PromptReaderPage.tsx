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
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookText, ChevronLeft, ChevronRight, Copy, Download, Inbox, Loader2, Maximize2, Minimize2, Package, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AGENT_REGISTRY, type AgentRegistryEntry, type AgentCategory } from "@/data/agentPrompts";
import { runAgentSimulator, type SimulatorResponse } from "@/data/agentSimulator";
import { findKbEntries, type KbEntry } from "@/data/kbEntries";
import PromptCopilotPanel from "./PromptCopilotPanel";
import { SwapPanels, type SwapPanelDef } from "./components/SwapPanels";

const PANEL_ORDER_KEY = "prompt-reader.panel-order";
const COPILOT_EXPANDED_KEY = "prompt-reader.copilot-expanded";
type PanelId = "reader" | "copilot";

function readPanelOrder(): [PanelId, PanelId] {
  try {
    const raw = localStorage.getItem(PANEL_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((x) => x === "reader" || x === "copilot") && parsed[0] !== parsed[1]) {
        return parsed as [PanelId, PanelId];
      }
    }
  } catch { /* noop */ }
  return ["reader", "copilot"];
}
function readExpanded(): PanelId | null {
  try {
    const raw = localStorage.getItem(COPILOT_EXPANDED_KEY);
    if (raw === "copilot" || raw === "reader") return raw;
  } catch { /* noop */ }
  return null;
}

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

function downloadText(filename: string, text: string, mime = "text/markdown") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function kbForAgent(all: KbEntry[], agent: AgentRegistryEntry): KbEntry[] {
  const cats = new Set(agent.kbCategories);
  return all
    .filter((e) => e.is_active && cats.has(e.category))
    .sort((a, b) =>
      a.category.localeCompare(b.category) ||
      (a.chapter ?? "").localeCompare(b.chapter ?? "") ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
}

function buildAgentMarkdown(agent: AgentRegistryEntry, sim: SimulatorResponse | undefined, kb: KbEntry[]): string {
  const lines: string[] = [];
  lines.push(`# ${agent.displayName}`);
  lines.push("");
  lines.push(`> ${agent.description}`);
  lines.push("");
  lines.push(`- **Categoria:** ${agent.category}`);
  lines.push(`- **Edge function:** ${agent.runtime.edgeFunction || "—"}`);
  lines.push(`- **Modello default:** ${agent.runtime.modelDefault}`);
  lines.push(`- **Categorie KB:** ${agent.kbCategories.join(", ") || "—"}`);
  lines.push("");
  if (sim) {
    lines.push(`## System prompt assemblato (${sim.assembled.char_count.toLocaleString("it-IT")} caratteri)`);
    lines.push("");
    lines.push("```");
    lines.push(sim.assembled.system_prompt || "(vuoto)");
    lines.push("```");
    lines.push("");
    lines.push("## Persona");
    lines.push("");
    if (sim.persona.loaded) {
      lines.push(`- Tono: ${sim.persona.tone ?? "—"}`);
      lines.push(`- Lingua: ${sim.persona.language ?? "—"}`);
      lines.push("");
      lines.push("```");
      lines.push(sim.persona.block_preview ?? "");
      lines.push("```");
    } else {
      lines.push(`_${sim.persona.note ?? "Nessuna persona definita."}_`);
    }
    lines.push("");
    lines.push(`## Prompt operativi (${sim.operative_prompts.applied.length})`);
    lines.push("");
    if (sim.operative_prompts.applied.length === 0) {
      lines.push("_Nessun prompt operativo applicato._");
    } else {
      lines.push(sim.operative_prompts.applied.map((n) => `- ${n}`).join("\n"));
      lines.push("");
      lines.push("```");
      lines.push(sim.operative_prompts.block_preview || "");
      lines.push("```");
    }
    lines.push("");
    lines.push("## Tool effettivi");
    lines.push("");
    lines.push(`Consentiti: ${sim.tools.effective.join(", ") || "nessuno"}`);
    if (sim.tools.filtered_out.length > 0) {
      lines.push("");
      lines.push(`Filtrati dalle capabilities: ${sim.tools.filtered_out.join(", ")}`);
    }
    lines.push("");
    lines.push("## Hard guards");
    lines.push("");
    lines.push(`- Tabelle vietate: ${sim.hard_guards.forbidden_tables.join(", ")}`);
    lines.push(`- Operazioni distruttive bloccate: ${sim.hard_guards.destructive_ops_blocked.join(", ")}`);
    lines.push(`- Approvazione sempre richiesta: ${sim.hard_guards.approval_required_always.join(", ")}`);
    lines.push("");
  }
  lines.push(`## Knowledge Base usata (${kb.length} entry)`);
  lines.push("");
  if (kb.length === 0) {
    lines.push("_Nessuna entry KB attiva nelle categorie consultate da questo agente._");
  } else {
    let lastChapter = "";
    let lastCategory = "";
    for (const e of kb) {
      if (e.category !== lastCategory) {
        lines.push("");
        lines.push(`### Categoria: \`${e.category}\``);
        lastCategory = e.category;
        lastChapter = "";
      }
      const chap = e.chapter || "(senza capitolo)";
      if (chap !== lastChapter) {
        lines.push("");
        lines.push(`#### ${chap}`);
        lastChapter = chap;
      }
      lines.push("");
      lines.push(`**${e.title}**  \n_priority ${e.priority} · tags: ${e.tags?.join(", ") || "—"}_`);
      lines.push("");
      lines.push(e.content);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function buildToolsMarkdown(allAgents: AgentRegistryEntry[], sims: Record<string, SimulatorResponse>): string {
  const lines: string[] = [];
  lines.push("# Funzioni & Strumenti — agenti AI");
  lines.push("");
  lines.push(`Generato: ${new Date().toLocaleString("it-IT")}`);
  lines.push("");
  // Indice tool universale
  const universe = new Set<string>();
  for (const s of Object.values(sims)) for (const t of s.tools.all_registered) universe.add(t);
  // fallback dal registry statico
  for (const a of allAgents) for (const t of a.tools) universe.add(t);
  const sortedUniverse = Array.from(universe).sort();

  // Mappa tool -> agenti che lo usano (effective)
  const toolToAgents = new Map<string, string[]>();
  for (const a of allAgents) {
    const sim = sims[a.id];
    const list = sim ? sim.tools.effective : a.tools;
    for (const t of list) {
      if (!toolToAgents.has(t)) toolToAgents.set(t, []);
      toolToAgents.get(t)!.push(a.displayName);
    }
  }

  lines.push("## Catalogo tool");
  lines.push("");
  for (const t of sortedUniverse) {
    const users = toolToAgents.get(t) ?? [];
    lines.push(`### \`${t}\``);
    lines.push(`- Agenti che lo usano (${users.length}): ${users.join(", ") || "—"}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Agenti — tool effettivi");
  lines.push("");
  for (const a of allAgents) {
    const sim = sims[a.id];
    lines.push(`### ${a.displayName} (\`${a.id}\`)`);
    lines.push(`- Edge function: ${a.runtime.edgeFunction || "—"}`);
    lines.push(`- Modello: ${a.runtime.modelDefault}`);
    if (sim) {
      lines.push(`- Tool consentiti: ${sim.tools.effective.join(", ") || "nessuno"}`);
      if (sim.tools.filtered_out.length) {
        lines.push(`- Tool filtrati: ${sim.tools.filtered_out.join(", ")}`);
      }
      const approval = sim.tools.approval_map.filter((m) => m.requires_approval).map((m) => m.name);
      if (approval.length) lines.push(`- Richiedono approvazione: ${approval.join(", ")}`);
    } else {
      lines.push(`- Tool dichiarati (registry): ${a.tools.join(", ") || "nessuno"}`);
      if (a.approvalRequiredTools.length) {
        lines.push(`- Richiedono approvazione: ${a.approvalRequiredTools.join(", ")}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
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
  const [kbAll, setKbAll] = useState<KbEntry[] | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [targetBlock, setTargetBlock] = useState<{ name: string; content: string }>({
    name: "system_prompt",
    content: "",
  });
  const [panelOrder, setPanelOrder] = useState<[PanelId, PanelId]>(() => readPanelOrder());
  const [expandedPanel, setExpandedPanel] = useState<PanelId | null>(() => readExpanded());
  // ResizeObserver: misura la larghezza del pannello Co-pilot per attivare layout 2-colonne
  const copilotWrapperRef = useRef<HTMLDivElement | null>(null);
  const [copilotCompact, setCopilotCompact] = useState(false);
  useEffect(() => {
    const el = copilotWrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Soglia: >=720px → 2 colonne (proposta SX, chat DX). Sotto resta verticale.
        setCopilotCompact(entry.contentRect.width >= 720);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [expandedPanel, sidebarOpen]);

  useEffect(() => {
    try { localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(panelOrder)); } catch { /* noop */ }
  }, [panelOrder]);
  useEffect(() => {
    try {
      if (expandedPanel) localStorage.setItem(COPILOT_EXPANDED_KEY, expandedPanel);
      else localStorage.removeItem(COPILOT_EXPANDED_KEY);
    } catch { /* noop */ }
  }, [expandedPanel]);

  const selected = allAgents.find((a) => a.id === selectedId) ?? allAgents[0];
  const data: SimulatorResponse | undefined = selected ? cache[selected.id] : undefined;

  // Sync default target block content quando cambia l'agente
  useEffect(() => {
    if (data?.assembled?.system_prompt) {
      setTargetBlock((prev) => prev.name === "system_prompt"
        ? { name: "system_prompt", content: data.assembled.system_prompt }
        : prev);
    }
  }, [data]);

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

  // Carica KB una sola volta
  useEffect(() => {
    findKbEntries().then(setKbAll).catch((e) => {
      console.error("KB load failed", e);
      toast.error("Caricamento KB fallito");
      setKbAll([]);
    });
  }, []);

  const kbCurrent = useMemo(
    () => (kbAll && selected ? kbForAgent(kbAll, selected) : []),
    [kbAll, selected],
  );

  async function downloadAgent() {
    if (!selected) return;
    setDownloading("agent");
    try {
      const sim = cache[selected.id] ?? (await runAgentSimulator({
        agentId: selected.id,
        userMessage: "(export)",
        dryRunAI: false,
      }));
      const md = buildAgentMarkdown(selected, sim, kbCurrent);
      downloadText(`${slug(selected.displayName)}-prompt-kb.md`, md);
      toast.success("Download avviato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore export");
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAllAgents() {
    setDownloading("all");
    try {
      const list = allAgents;
      // Pre-load mancanti in serie (evita di saturare l'edge)
      const sims: Record<string, SimulatorResponse> = { ...cache };
      for (const a of list) {
        if (sims[a.id]) continue;
        try {
          sims[a.id] = await runAgentSimulator({ agentId: a.id, userMessage: "(export)", dryRunAI: false });
        } catch (e) {
          console.warn("simulator failed for", a.id, e);
        }
      }
      setCache(sims);
      const parts = list.map((a) => buildAgentMarkdown(a, sims[a.id], kbAll ? kbForAgent(kbAll, a) : []));
      const md = parts.join("\n\n---\n\n");
      downloadText(`agenti-prompt-kb.md`, md);
      toast.success("Export completato");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore export");
    } finally {
      setDownloading(null);
    }
  }

  async function downloadTools() {
    setDownloading("tools");
    try {
      const sims: Record<string, SimulatorResponse> = { ...cache };
      // Servono almeno 1-2 sim per popolare tools effettivi; carichiamo tutti come per "all" (in serie)
      for (const a of allAgents) {
        if (sims[a.id]) continue;
        try {
          sims[a.id] = await runAgentSimulator({ agentId: a.id, userMessage: "(export)", dryRunAI: false });
        } catch (e) {
          console.warn("simulator failed for", a.id, e);
        }
      }
      setCache(sims);
      const md = buildToolsMarkdown(allAgents, sims);
      downloadText("funzioni-e-strumenti.md", md);
      toast.success("Documento Funzioni & Strumenti pronto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore export");
    } finally {
      setDownloading(null);
    }
  }

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
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5" title="Review change request del Co-pilot">
            <Link to="/v2/prompt-lab/proposals">
              <Inbox className="h-3.5 w-3.5" /> Proposte
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            onClick={() => selected && load(selected.id, true)}
            disabled={loadingId === selected?.id}
            title="Ricarica prompt assemblato"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingId === selected?.id && "animate-spin")} />
            Ricarica
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            onClick={downloadAgent}
            disabled={!selected || downloading !== null}
            title="Scarica prompt + KB di questo agente (Markdown)"
          >
            {downloading === "agent" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Scarica persona
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            onClick={downloadAllAgents}
            disabled={downloading !== null}
            title="Scarica prompt + KB di tutti gli agenti"
          >
            {downloading === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
            Scarica tutto
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1.5"
            onClick={downloadTools}
            disabled={downloading !== null}
            title="Documento delle funzioni e degli strumenti chiamati dagli agenti"
          >
            {downloading === "tools" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
            Funzioni & Strumenti
          </Button>
        </div>
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

        {/* Pannelli Reader + Co-pilot, scambiabili via drag&drop */}
        <SwapPanels
          order={panelOrder}
          onReorder={(next) => setPanelOrder(next as [PanelId, PanelId])}
          expandedId={expandedPanel}
          panels={[
            {
              id: "reader",
              title: "Prompt Reader",
              toolbar: (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => setExpandedPanel(expandedPanel === "reader" ? null : "reader")}
                  title={expandedPanel === "reader" ? "Riduci" : "Espandi a tutta larghezza"}
                >
                  {expandedPanel === "reader" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              ),
              content: (
                <div className="h-full overflow-auto">
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

            {/* 7. Knowledge Base usata (sempre visibile se KB caricata) */}
            {selected && kbAll && (
              <Section
                title="Knowledge Base usata da questo agente"
                meta={`${kbCurrent.length} entry · categorie: ${selected.kbCategories.join(", ") || "—"}`}
                onCopy={kbCurrent.length > 0 ? () => copy(buildAgentMarkdown(selected, data, kbCurrent), "KB") : undefined}
              >
                {kbCurrent.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nessuna entry attiva nelle categorie consultate ({selected.kbCategories.join(", ") || "nessuna categoria dichiarata"}).
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-auto">
                    {(() => {
                      const out: React.ReactNode[] = [];
                      let lastCat = "";
                      let lastChap = "";
                      kbCurrent.forEach((e) => {
                        if (e.category !== lastCat) {
                          out.push(
                            <h4 key={`cat-${e.id}`} className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b pb-1 pt-2">
                              Categoria: <span className="font-mono">{e.category}</span>
                            </h4>,
                          );
                          lastCat = e.category;
                          lastChap = "";
                        }
                        const chap = e.chapter || "(senza capitolo)";
                        if (chap !== lastChap) {
                          out.push(
                            <h5 key={`chap-${e.id}`} className="text-[11px] font-semibold text-muted-foreground mt-2">
                              {chap}
                            </h5>,
                          );
                          lastChap = chap;
                        }
                        out.push(
                          <div
                            key={e.id}
                            className="rounded border bg-muted/20 p-2"
                            title={`priority ${e.priority} · tags: ${e.tags?.join(", ") || "—"} · aggiornato ${new Date(e.updated_at).toLocaleString("it-IT")}`}
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-medium">{e.title}</span>
                              <Badge variant="outline" className="text-[9px]">prio {e.priority}</Badge>
                              {(e.tags ?? []).slice(0, 4).map((t) => (
                                <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>
                              ))}
                            </div>
                            <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                              {e.content}
                            </pre>
                          </div>,
                        );
                      });
                      return out;
                    })()}
                  </div>
                )}
              </Section>
            )}
                  </div>
                </div>
              ),
            },
            {
              id: "copilot",
              title: "Co-pilot",
              toolbar: (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => setExpandedPanel(expandedPanel === "copilot" ? null : "copilot")}
                  title={expandedPanel === "copilot" ? "Riduci" : "Espandi a tutta larghezza"}
                >
                  {expandedPanel === "copilot" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              ),
              content: selected ? (
                <div ref={copilotWrapperRef} className="h-full">
                  <PromptCopilotPanel
                    agentSlug={selected.id}
                    agentKbCategories={selected.kbCategories}
                    blockName={targetBlock.name}
                    currentContent={targetBlock.content || data?.assembled?.system_prompt || ""}
                    expanded={expandedPanel === "copilot"}
                    compactWidth={copilotCompact}
                  />
                </div>
              ) : (
                <div className="p-4 text-xs text-muted-foreground">Seleziona un agente.</div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
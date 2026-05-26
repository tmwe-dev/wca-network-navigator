import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AGENT_REGISTRY, type AgentRegistryEntry, type AgentCategory } from "@/data/agentPrompts";
import { runAgentSimulator, type SimulatorResponse } from "@/data/agentSimulator";
import { findKbEntries, type KbEntry } from "@/data/kbEntries";
import { PANEL_ORDER_KEY, COPILOT_EXPANDED_KEY, readPanelOrder, readExpanded, type PanelId } from "./constants";
import { kbForAgent, downloadText, slug } from "./utils";
import { buildAgentMarkdown, buildToolsMarkdown } from "./markdown";

import { createLogger } from "@/lib/log";

const log = createLogger("promptReader");

export function usePromptReaderState() {
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
  const copilotWrapperRef = useRef<HTMLDivElement | null>(null);
  const [copilotCompact, setCopilotCompact] = useState(false);

  useEffect(() => {
    const el = copilotWrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setCopilotCompact(entry.contentRect.width >= 720);
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

  useEffect(() => {
    findKbEntries().then(setKbAll).catch((e) => {
      log.error("KB load failed", { detail: e });
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
      const sims: Record<string, SimulatorResponse> = { ...cache };
      for (const a of list) {
        if (sims[a.id]) continue;
        try {
          sims[a.id] = await runAgentSimulator({ agentId: a.id, userMessage: "(export)", dryRunAI: false });
        } catch (e) {
          log.warn("simulator failed for", { detail: a.id, e });
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
      for (const a of allAgents) {
        if (sims[a.id]) continue;
        try {
          sims[a.id] = await runAgentSimulator({ agentId: a.id, userMessage: "(export)", dryRunAI: false });
        } catch (e) {
          log.warn("simulator failed for", { detail: a.id, e });
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

  return {
    allAgents, selected, selectedId, setSelectedId,
    sidebarOpen, setSidebarOpen,
    data, loadingId, errorMsg, kbAll, kbCurrent,
    grouped, panelOrder, setPanelOrder, expandedPanel, setExpandedPanel,
    copilotWrapperRef, copilotCompact,
    targetBlock,
    downloading,
    load, downloadAgent, downloadAllAgents, downloadTools,
  };
}
import { useCallback } from "react";
import { toast } from "sonner";
import { resolveTool, TOOLS } from "../tools/registry";
import type { ToolResult } from "../tools/types";
import type { CommandPageState } from "./useCommandPageState";

interface Governance {
  role: string;
  permission: string;
  policy: string;
}

interface ToolLabel {
  agentLabel: string;
  queryLabel: string;
  isComposer: boolean;
  isFlow: boolean;
  isTimeline: boolean;
  isCardGrid: boolean;
}

function getToolLabels(toolId: string): ToolLabel {
  const isComposer = toolId === "compose-email";
  const isFlow = toolId === "campaign-status";
  const isTimeline = toolId === "agent-report";
  const isCardGrid = toolId === "followup-batch";

  return {
    isComposer,
    isFlow,
    isTimeline,
    isCardGrid,
    agentLabel: isComposer
      ? "Email Composer"
      : isFlow
        ? "Campaign Manager"
        : isTimeline
          ? "Agent Monitor"
          : isCardGrid
            ? "Follow-up Watcher"
            : "Partner Scout",
    queryLabel: isComposer
      ? "Preparazione Composer"
      : isFlow
        ? "Query Supabase · Campaign Jobs"
        : isTimeline
          ? "Query Supabase · Agents + Activities"
          : isCardGrid
            ? "Query Supabase · Search Contacts"
            : "Query Supabase · Search Partners",
  };
}

function getCanvasType(toolId: string): string {
  if (toolId === "compose-email") return "live-composer";
  if (toolId === "campaign-status") return "live-flow";
  if (toolId === "agent-report") return "live-timeline";
  if (toolId === "followup-batch") return "live-card-grid";
  return "live-table";
}

function getCountLabel(toolId: string, result: ToolResult): string {
  const isComposer = toolId === "compose-email";
  const isFlow = toolId === "campaign-status";
  const isTimeline = toolId === "agent-report";
  const isCardGrid = toolId === "followup-batch";

  if (isComposer) return "Composer pronto";
  if (isFlow) return `${result.meta?.count ?? 0} job in ${result.kind === "flow" ? result.nodes.length / 2 : 0} batch`;
  if (isTimeline) return `${result.meta?.count ?? 0} attività negli ultimi 7gg`;
  if (isCardGrid) return `${result.kind === "card-grid" ? result.cards.length : 0} contatti inattivi`;
  return `${result.meta?.count ?? 0} risultati`;
}

export function useToolExecution(pageState: CommandPageState, governance: Governance) {
  return useCallback(
    async (prompt: string) => {
      const tool = await resolveTool(prompt);
      if (!tool) {
        pageState.addMessage({
          role: "assistant",
          content: "Non ho capito cosa vuoi fare. Puoi riformulare la richiesta?",
          timestamp: pageState.ts(),
          agentName: "Orchestratore",
        });
        return false;
      }

      pageState.setFlowPhase("thinking");
      pageState.setShowTools(true);
      pageState.setToolPhase("activating");
      pageState.setChainHighlight(0);
      pageState.setActiveScenarioKey("churn");

      pageState.addMessage({
        role: "assistant",
        content: "",
        timestamp: "",
        thinking: true,
      });

      const chainInterval = setInterval(() => {
        pageState.setChainHighlight((prev) => {
          if (prev === undefined || prev >= 2) return prev;
          return prev + 1;
        });
      }, 700);

      await new Promise((r) => setTimeout(r, 1500));
      clearInterval(chainInterval);

      pageState.setMessages((prev) => prev.filter((m) => !m.thinking));
      pageState.setToolPhase("active");
      pageState.setChainHighlight(3);

      const labels = getToolLabels(tool.id);

      pageState.addMessage({
        role: "assistant",
        content: labels.isComposer
          ? `Sto preparando il composer email...\n\nAnalisi del prompt per estrarre destinatario e oggetto.`
          : labels.isFlow
            ? `Sto analizzando lo stato delle campagne usando **Campaign Jobs**...\n\nAggregazione batch in corso.`
            : labels.isTimeline
              ? `Sto aggregando le attività degli agenti negli ultimi 7 giorni usando **Agents + Activities**...\n\nReport in preparazione.`
              : labels.isCardGrid
                ? `Sto cercando contatti inattivi nel database usando **Search Contacts**...\n\nFiltro: nessuna interazione negli ultimi 30 giorni.`
                : `Sto cercando partner nel database WCA usando **Search Partners**...\n\nQuery in corso tramite il modulo partner management.`,
        agentName: labels.agentLabel,
        timestamp: pageState.ts(),
        meta: labels.isComposer
          ? "composer · generate-email + send-email · 2 edge fn"
          : labels.isFlow
            ? "campaign-mgr · campaign_jobs · 1 modulo"
            : labels.isTimeline
              ? "agent-monitor · agents+activities · 2 moduli"
              : labels.isCardGrid
                ? "contact-db · search-contacts · 1 modulo"
                : "partner-mgmt · search-partners · 1 modulo",
        governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
      });

      pageState.setFlowPhase("executing");
      pageState.setChainHighlight(5);

      const liveSteps = [
        { label: "Interpretazione richiesta", status: "done" as const },
        { label: labels.queryLabel, status: "running" as const },
        { label: "Rendering canvas", status: "pending" as const },
      ];
      pageState.setExecSteps(liveSteps);
      pageState.setExecProgress(33);

      try {
        const result = await tool.execute(prompt);

        if (result.kind === "approval") {
          pageState.setExecSteps([
            { label: "Interpretazione richiesta", status: "done" },
            { label: labels.queryLabel, status: "done", detail: "Approvazione richiesta" },
            { label: "In attesa conferma utente", status: "running" },
          ]);
          pageState.setExecProgress(66);
          pageState.setLiveResult(result);
          pageState.setPendingApproval({
            toolId: result.toolId,
            payload: result.pendingPayload,
            prompt,
          });
          pageState.setFlowPhase("proposal");
          pageState.setCanvas("live-approval");
          pageState.setShowTools(false);

          pageState.addMessage({
            role: "assistant",
            content: `**${result.title}**\n${result.description}\n\nApprovazione richiesta prima dell'esecuzione.`,
            agentName: labels.agentLabel,
            timestamp: pageState.ts(),
            meta: `governance · ${result.governance.permission}`,
            governance: `Ruolo: ${result.governance.role} · Permesso: ${result.governance.permission} · Policy: ${result.governance.policy}`,
          });
          return true;
        }

        if (result.kind === "result") {
          pageState.setExecSteps([
            { label: "Interpretazione richiesta", status: "done" },
            { label: labels.queryLabel, status: "done" },
            { label: "Operazione completata", status: "done" },
          ]);
          pageState.setExecProgress(100);
          pageState.setFlowPhase("done");
          pageState.setShowTools(false);
          toast.success(result.message);
          pageState.addMessage({
            role: "assistant",
            content: `✅ **${result.title}**\n${result.message}`,
            agentName: labels.agentLabel,
            timestamp: pageState.ts(),
            meta: result.meta?.sourceLabel,
          });
          return true;
        }

        if (result.kind === "report") {
          pageState.setExecSteps([
            { label: "Interpretazione richiesta", status: "done" },
            { label: labels.queryLabel, status: "done", detail: `${result.sections.length} sezioni` },
            { label: "Rendering report", status: "done" },
          ]);
          pageState.setExecProgress(100);
          pageState.setLiveResult(result);
          pageState.setFlowPhase("done");
          pageState.setCanvas("live-report");
          pageState.setShowTools(false);
          pageState.addMessage({
            role: "assistant",
            content: `Report generato con **${result.sections.length} sezioni**.\n\nDati da: ${result.meta?.sourceLabel ?? "AI"}`,
            agentName: labels.agentLabel,
            timestamp: pageState.ts(),
            meta: result.meta?.sourceLabel,
          });
          return true;
        }

        pageState.setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: labels.queryLabel, status: "done", detail: `${result.meta?.count ?? 0} risultati` },
          { label: "Rendering canvas", status: "done" },
        ]);
        pageState.setExecProgress(100);
        pageState.setLiveResult(result);

        await new Promise((r) => setTimeout(r, 400));

        pageState.setFlowPhase("done");
        pageState.setChainHighlight(6);
        pageState.setCanvas(getCanvasType(tool.id) as Parameters<typeof pageState.setCanvas>[0]);
        pageState.setShowTools(false);

        const countLabel = getCountLabel(tool.id, result);

        pageState.addMessage({
          role: "assistant",
          content: `Trovati **${countLabel}** nel database. Canvas aggiornato con i risultati live.\n\nDati da: ${result.meta?.sourceLabel ?? "Supabase"}`,
          agentName: labels.agentLabel,
          timestamp: pageState.ts(),
          meta: `${result.meta?.sourceLabel ?? "Supabase"} · ${result.meta?.count ?? 0} record · LIVE`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        pageState.setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: labels.queryLabel, status: "error", detail: "FAIL" },
          { label: "Rendering canvas", status: "pending" },
        ]);
        toast.error(msg);
        pageState.addMessage({
          role: "assistant",
          content: `Errore nella query: ${msg}`,
          agentName: labels.agentLabel,
          timestamp: pageState.ts(),
        });
        pageState.setFlowPhase("idle");
        pageState.setShowTools(false);
      }

      return true;
    },
    [pageState, governance],
  );
}

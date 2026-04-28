import { useCallback } from "react";
import { toast } from "sonner";
import { resolveTool, TOOLS } from "../tools/registry";
import type { ToolResult } from "../tools/types";
import type { CommandPageState } from "./useCommandPageState";
import { tryLocalComment } from "../lib/localResultFormatter";
import { getLastSuccessfulQueryPlan } from "../tools/aiQueryTool";

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
  const isDashboard = toolId === "dashboard-snapshot";
  const isKb = toolId === "search-kb";
  const isContacts = toolId === "deep-search-contact";

  return {
    isComposer,
    isFlow,
    isTimeline,
    isCardGrid,
    agentLabel: isComposer
      ? "Assistente email"
      : isFlow
        ? "Assistente campagne"
        : isTimeline
          ? "Resoconto attività"
          : isCardGrid
            ? "Promemoria contatti"
            : isDashboard
              ? "Panoramica sistema"
              : isKb
                ? "Guida e documentazione"
                : isContacts
                  ? "Ricerca contatti"
                  : "Ricerca partner",
    queryLabel: isComposer
      ? "Preparo l'email"
      : isFlow
        ? "Controllo le campagne in corso"
        : isTimeline
          ? "Riepilogo le ultime attività"
          : isCardGrid
            ? "Cerco i contatti da risentire"
            : isDashboard
              ? "Raccolgo i dati principali"
              : isKb
                ? "Cerco nelle guide"
                : isContacts
                  ? "Cerco tra i contatti"
                  : "Cerco tra i partner WCA",
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
          ? `Preparo l'email…`
          : labels.isFlow
            ? `Controllo le campagne…`
            : labels.isTimeline
              ? `Riepilogo ultimi 7 giorni…`
              : labels.isCardGrid
                ? `Cerco contatti inattivi…`
                : `Cerco nel database…`,
        agentName: labels.agentLabel,
        timestamp: pageState.ts(),
      });

      pageState.setFlowPhase("executing");
      pageState.setChainHighlight(5);

      const liveSteps = [
        { label: "Capisco la richiesta", status: "done" as const },
        { label: labels.queryLabel, status: "running" as const },
        { label: "Preparo i risultati", status: "pending" as const },
      ];
      pageState.setExecSteps(liveSteps);
      pageState.setExecProgress(33);

      try {
        const result = await tool.execute(prompt);

        if (result.kind === "approval") {
          pageState.setExecSteps([
            { label: "Capisco la richiesta", status: "done" },
            { label: labels.queryLabel, status: "done", detail: "Serve la tua conferma" },
            { label: "In attesa della tua approvazione", status: "running" },
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
            content: `${result.title}. ${result.description} Procedo?`,
            agentName: labels.agentLabel,
            timestamp: pageState.ts(),
          });
          return true;
        }

        if (result.kind === "result") {
          pageState.setExecSteps([
            { label: "Capisco la richiesta", status: "done" },
            { label: labels.queryLabel, status: "done" },
            { label: "Fatto", status: "done" },
          ]);
          pageState.setExecProgress(100);
          pageState.setFlowPhase("done");
          pageState.setShowTools(false);
          toast.success(result.message);
          pageState.addMessage({
            role: "assistant",
            content: `✅ ${result.message}`,
            agentName: labels.agentLabel,
            timestamp: pageState.ts(),
          });
          return true;
        }

        if (result.kind === "report") {
          pageState.setExecSteps([
            { label: "Capisco la richiesta", status: "done" },
            { label: labels.queryLabel, status: "done", detail: `${result.sections.length} sezioni` },
            { label: "Report pronto", status: "done" },
          ]);
          pageState.setExecProgress(100);
          pageState.setLiveResult(result);
          pageState.setFlowPhase("done");
          pageState.setCanvas("live-report");
          pageState.setShowTools(false);
          pageState.addMessage({
            role: "assistant",
            content: `Report pronto (${result.sections.length} sezioni) →`,
            agentName: labels.agentLabel,
            timestamp: pageState.ts(),
          });
          return true;
        }

        pageState.setExecSteps([
          { label: "Capisco la richiesta", status: "done" },
          { label: labels.queryLabel, status: "done", detail: `${result.meta?.count ?? 0} risultati` },
          { label: "Risultati pronti", status: "done" },
        ]);
        pageState.setExecProgress(100);
        pageState.setLiveResult(result);

        await new Promise((r) => setTimeout(r, 400));

        pageState.setFlowPhase("done");
        pageState.setChainHighlight(6);
        pageState.setCanvas(getCanvasType(tool.id) as Parameters<typeof pageState.setCanvas>[0]);
        pageState.setShowTools(false);

        const countLabel = getCountLabel(tool.id, result);

        // For AI-query results, try local formatter to get a sharp answer + clickable next-step chips.
        let messageContent = `${countLabel} →`;
        let suggestedActions: { label: string; prompt: string }[] | undefined;
        if (tool.id === "ai-query") {
          const plan = getLastSuccessfulQueryPlan();
          const local = tryLocalComment(prompt, result, plan);
          if (local) {
            messageContent = local.message;
            suggestedActions = local.suggestedActions.length > 0 ? [...local.suggestedActions] : undefined;
          }
        }

        pageState.addMessage({
          role: "assistant",
          content: messageContent,
          agentName: labels.agentLabel,
          timestamp: pageState.ts(),
          suggestedActions,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        pageState.setExecSteps([
          { label: "Capisco la richiesta", status: "done" },
          { label: labels.queryLabel, status: "error", detail: "FAIL" },
          { label: "Risultati pronti", status: "pending" },
        ]);
        toast.error(msg);
        pageState.addMessage({
          role: "assistant",
          content: `Non sono riuscito a completare: ${msg}`,
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

import { useCallback } from "react";
import { toast } from "sonner";
import { TOOLS } from "../tools/registry";
import type { CommandPageState } from "./useCommandPageState";

export function useApprovalFlow(pageState: CommandPageState) {
  const handleApprove = useCallback(async () => {
    if (pageState.pendingApproval) {
      const tool = TOOLS.find((t) => t.id === pageState.pendingApproval!.toolId);
      if (!tool) return;

      pageState.setFlowPhase("executing");
      pageState.setCanvas(null);
      pageState.setPendingApproval(null);
      pageState.addMessage({
        role: "assistant",
        content: "Esecuzione in corso...",
        timestamp: pageState.ts(),
        agentName: "Automation",
      });

      try {
        const result = await tool.execute(pageState.pendingApproval.prompt, {
          confirmed: true,
          payload: pageState.pendingApproval.payload,
        });

        if (result.kind === "result") {
          toast.success(result.message);
          pageState.addMessage({
            role: "assistant",
            content: `✅ **${result.title}**\n${result.message}`,
            agentName: "Automation",
            timestamp: pageState.ts(),
            meta: result.meta?.sourceLabel,
          });
        }

        pageState.setFlowPhase("done");
        pageState.setLiveResult(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore";
        toast.error(msg);
        pageState.addMessage({
          role: "assistant",
          content: `❌ Errore: ${msg}`,
          agentName: "Automation",
          timestamp: pageState.ts(),
        });
        pageState.setFlowPhase("idle");
      }
      return;
    }

    if (!pageState.activeScenario) return;

    pageState.setFlowPhase("executing");
    pageState.setCanvas(null);
    pageState.setChainHighlight(5);

    pageState.addMessage({
      role: "assistant",
      content:
        "Esecuzione avviata. Automation Agent coordina gli step operativi. Governance Agent monitora ogni azione con audit trail completo.",
      timestamp: pageState.ts(),
      agentName: "Automation",
      meta: "Execution Engine · Governance · Audit Action · attivo",
    });

    if (pageState.activeScenario.executionSteps) {
      pageState.setExecSteps(pageState.activeScenario.executionSteps);
      pageState.setExecProgress(0);

      const steps = [...pageState.activeScenario.executionSteps];
      let progress = 0;

      const interval = setInterval(() => {
        progress += 12;
        if (progress > 100) progress = 100;
        pageState.setExecProgress(progress);

        const updated = steps.map((s, i) => {
          if (progress > ((i + 1) * 100) / steps.length)
            return { ...s, status: "done" as const, detail: s.detail || "✓" };
          if (progress > (i * 100) / steps.length) return { ...s, status: "running" as const };
          return s;
        });

        pageState.setExecSteps(updated);

        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            pageState.setFlowPhase("done");
            pageState.setChainHighlight(6);
            pageState.setCanvas(pageState.activeScenario!.resultCanvas || null);
            pageState.setShowTools(false);
            pageState.setToolPhase("done");
            pageState.addMessage({
              role: "assistant",
              content:
                "Esecuzione completata. Tutti gli step verificati dal Governance Agent. Audit log aggiornato.\n\nVuoi salvare questo flusso come template operativo?",
              timestamp: pageState.ts(),
              agentName: "Orchestratore",
            });
          }, 600);
        }
      }, 700);
    }
  }, [pageState]);

  const handleCancel = useCallback(() => {
    pageState.resetFlow();
    toast("Azione annullata");
    pageState.addMessage({
      role: "assistant",
      content:
        "Operazione annullata. Nessuna azione eseguita. Audit Action: cancellazione registrata.",
      timestamp: pageState.ts(),
      agentName: "Orchestratore",
    });
  }, [pageState]);

  return { handleApprove, handleCancel };
}

import { useState, useCallback, useRef } from "react";
import { matchScenario, type MockScenario } from "./mockScenarios";
import { resolveTool } from "./tools/registry";
import type { ToolResult } from "./tools/types";
import type { ExecutionStep } from "@/design-system/ExecutionFlow";

export type CommandPhase = "idle" | "thinking" | "proposal" | "executing" | "done" | "error";

interface CommandFlowState {
  phase: CommandPhase;
  scenario: MockScenario | null;
  executionSteps: ExecutionStep[];
  executionProgress: number;
  thinkingLabel: string;
  toolResult: ToolResult | null;
  isLive: boolean;
  errorMessage: string | null;
}

const thinkingLabels = [
  "Analizzo la richiesta…",
  "Scelgo gli strumenti giusti…",
  "Preparo la proposta…",
];

export function useCommandFlow() {
  const [state, setState] = useState<CommandFlowState>({
    phase: "idle",
    scenario: null,
    executionSteps: [],
    executionProgress: 0,
    thinkingLabel: thinkingLabels[0],
    toolResult: null,
    isLive: false,
    errorMessage: null,
  });

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const runLiveTool = useCallback(async (prompt: string) => {
    const tool = await resolveTool(prompt);
    if (!tool) return false;

    const liveSteps: ExecutionStep[] = [
      { label: "Interpretazione richiesta", status: "done" },
      { label: "Query Supabase", status: "running" },
      { label: "Rendering canvas", status: "pending" },
    ];

    setState({
      phase: "executing",
      scenario: null,
      executionSteps: liveSteps,
      executionProgress: 33,
      thinkingLabel: "Query in corso…",
      toolResult: null,
      isLive: true,
      errorMessage: null,
    });

    try {
      const result = await tool.execute(prompt);

      setState((s) => ({
        ...s,
        executionSteps: [
          { label: "Interpretazione richiesta", status: "done" },
          { label: "Query Supabase", status: "done" },
          { label: "Rendering canvas", status: "running" },
        ],
        executionProgress: 66,
      }));

      await new Promise((r) => setTimeout(r, 400));

      setState((s) => ({
        ...s,
        phase: "done",
        executionSteps: [
          { label: "Interpretazione richiesta", status: "done" },
          { label: "Query Supabase", status: "done" },
          { label: "Rendering canvas", status: "done" },
        ],
        executionProgress: 100,
        toolResult: result,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      setState((s) => ({
        ...s,
        phase: "error",
        errorMessage: msg,
        executionSteps: [
          { label: "Interpretazione richiesta", status: "done" },
          { label: "Query Supabase", status: "error", detail: "FAIL" },
          { label: "Rendering canvas", status: "pending" },
        ],
        executionProgress: 33,
      }));
    }

    return true;
  }, []);

  const submit = useCallback(async (prompt: string) => {
    clearTimers();

    setState({
      phase: "thinking",
      scenario: null,
      executionSteps: [],
      executionProgress: 0,
      thinkingLabel: thinkingLabels[0],
      toolResult: null,
      isLive: false,
      errorMessage: null,
    });

    const t1 = setTimeout(() => {
      setState((s) => ({ ...s, thinkingLabel: thinkingLabels[1] }));
    }, 400);
    timersRef.current.push(t1);

    await new Promise((r) => {
      const t = setTimeout(r, 800);
      timersRef.current.push(t);
    });

    const handled = await runLiveTool(prompt);
    if (handled) return;

    const scenario = matchScenario(prompt);
    const skipApproval = scenario.approvalPayload === null;

    setState((s) => ({
      ...s,
      scenario,
      thinkingLabel: thinkingLabels[2],
    }));

    const t3 = setTimeout(() => {
      if (skipApproval) {
        const steps = scenario.executionSteps.map((st) => ({ ...st, status: "pending" as const }));
        setState((s) => ({ ...s, phase: "executing", executionSteps: steps, executionProgress: 0 }));
        runMockExecution(steps);
      } else {
        setState((s) => ({ ...s, phase: "proposal" }));
      }
    }, 1200);
    timersRef.current.push(t3);
  }, [clearTimers, runLiveTool]);

  const runMockExecution = useCallback((steps: ExecutionStep[]) => {
    let current = 0;
    const total = steps.length;

    const tick = () => {
      if (current >= total) {
        setState((s) => ({ ...s, phase: "done", executionProgress: 100 }));
        return;
      }

      setState((s) => {
        const updated = s.executionSteps.map((step, i) => {
          if (i < current) return { ...step, status: "done" as const };
          if (i === current) return { ...step, status: "running" as const };
          return { ...step, status: "pending" as const };
        });
        return { ...s, executionSteps: updated, executionProgress: Math.round(((current + 0.5) / total) * 100) };
      });

      const delay = 600 + Math.random() * 300;
      const t = setTimeout(() => {
        setState((s) => {
          const updated = s.executionSteps.map((step, i) => {
            if (i <= current) return { ...step, status: "done" as const };
            return step;
          });
          return { ...s, executionSteps: updated, executionProgress: Math.round(((current + 1) / total) * 100) };
        });
        current++;
        const t2 = setTimeout(tick, 200);
        timersRef.current.push(t2);
      }, delay);
      timersRef.current.push(t);
    };

    tick();
  }, []);

  const approve = useCallback(() => {
    if (!state.scenario || state.phase !== "proposal") return;
    const steps = state.scenario.executionSteps.map((s) => ({ ...s, status: "pending" as const }));
    setState((s) => ({ ...s, phase: "executing", executionSteps: steps, executionProgress: 0 }));
    runMockExecution(steps);
  }, [state.scenario, state.phase, runMockExecution]);

  const cancel = useCallback(() => {
    clearTimers();
    setState({
      phase: "idle", scenario: null, executionSteps: [], executionProgress: 0,
      thinkingLabel: thinkingLabels[0], toolResult: null, isLive: false, errorMessage: null,
    });
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setState({
      phase: "idle", scenario: null, executionSteps: [], executionProgress: 0,
      thinkingLabel: thinkingLabels[0], toolResult: null, isLive: false, errorMessage: null,
    });
  }, [clearTimers]);

  return {
    phase: state.phase,
    scenario: state.scenario,
    executionSteps: state.executionSteps,
    executionProgress: state.executionProgress,
    thinkingLabel: state.thinkingLabel,
    toolResult: state.toolResult,
    isLive: state.isLive,
    errorMessage: state.errorMessage,
    submit,
    approve,
    cancel,
    reset,
  };
}

import { useState, useCallback, useRef } from "react";
import { matchScenario, type MockScenario } from "./mockScenarios";
import type { ExecutionStep } from "@/design-system/ExecutionFlow";

export type CommandPhase = "idle" | "thinking" | "proposal" | "executing" | "done";

interface CommandFlowState {
  phase: CommandPhase;
  scenario: MockScenario | null;
  executionSteps: ExecutionStep[];
  executionProgress: number;
  thinkingLabel: string;
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
  });

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const submit = useCallback((prompt: string) => {
    clearTimers();
    const scenario = matchScenario(prompt);

    // If agent-report: no approval, go thinking → executing → done
    const skipApproval = scenario.approvalPayload === null;

    setState({
      phase: "thinking",
      scenario,
      executionSteps: [],
      executionProgress: 0,
      thinkingLabel: thinkingLabels[0],
    });

    // Cycle thinking labels
    const t1 = setTimeout(() => {
      setState((s) => ({ ...s, thinkingLabel: thinkingLabels[1] }));
    }, 900);
    timersRef.current.push(t1);

    const t2 = setTimeout(() => {
      setState((s) => ({ ...s, thinkingLabel: thinkingLabels[2] }));
    }, 1800);
    timersRef.current.push(t2);

    const t3 = setTimeout(() => {
      if (skipApproval) {
        // Go directly to executing
        const steps = scenario.executionSteps.map((s) => ({ ...s, status: "pending" as const }));
        setState((s) => ({ ...s, phase: "executing", executionSteps: steps, executionProgress: 0 }));
        runExecution(steps, scenario);
      } else {
        setState((s) => ({ ...s, phase: "proposal" }));
      }
    }, 2500);
    timersRef.current.push(t3);
  }, [clearTimers]);

  const runExecution = useCallback((steps: ExecutionStep[], scenario: MockScenario) => {
    let current = 0;
    const total = steps.length;

    const tick = () => {
      if (current >= total) {
        setState((s) => ({ ...s, phase: "done", executionProgress: 100 }));
        return;
      }

      // Set current to running
      setState((s) => {
        const updated = s.executionSteps.map((step, i) => {
          if (i < current) return { ...step, status: "done" as const };
          if (i === current) return { ...step, status: "running" as const };
          return { ...step, status: "pending" as const };
        });
        return {
          ...s,
          executionSteps: updated,
          executionProgress: Math.round(((current + 0.5) / total) * 100),
        };
      });

      const delay = 600 + Math.random() * 300;
      const t = setTimeout(() => {
        // Mark current as done
        setState((s) => {
          const updated = s.executionSteps.map((step, i) => {
            if (i <= current) return { ...step, status: "done" as const };
            return step;
          });
          return {
            ...s,
            executionSteps: updated,
            executionProgress: Math.round(((current + 1) / total) * 100),
          };
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
    runExecution(steps, state.scenario);
  }, [state.scenario, state.phase, runExecution]);

  const cancel = useCallback(() => {
    clearTimers();
    setState({
      phase: "idle",
      scenario: null,
      executionSteps: [],
      executionProgress: 0,
      thinkingLabel: thinkingLabels[0],
    });
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setState({
      phase: "idle",
      scenario: null,
      executionSteps: [],
      executionProgress: 0,
      thinkingLabel: thinkingLabels[0],
    });
  }, [clearTimers]);

  return {
    phase: state.phase,
    scenario: state.scenario,
    executionSteps: state.executionSteps,
    executionProgress: state.executionProgress,
    thinkingLabel: state.thinkingLabel,
    submit,
    approve,
    cancel,
    reset,
  };
}

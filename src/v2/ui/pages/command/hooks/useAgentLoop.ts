/**
 * useAgentLoop — hook for running the multi-step agent loop from CommandPage.
 */
import { useState, useRef, useCallback } from "react";
import { runAgentLoop, type AgentState, type AgentStep } from "@/v2/agent/runtime/agentLoop";
import { supabase } from "@/integrations/supabase/client";

export interface UseAgentLoopReturn {
  state: AgentState;
  start: (goal: string) => void;
  stop: () => void;
  approveStep: () => void;
  rejectStep: () => void;
  autonomousMode: boolean;
  setAutonomousMode: (v: boolean) => void;
}

const INITIAL_STATE: AgentState = {
  running: false,
  step: 0,
  transcript: [],
  lastResult: null,
  error: null,
  finished: false,
  finalAnswer: null,
};

export function useAgentLoop(): UseAgentLoopReturn {
  const [state, setState] = useState<AgentState>(INITIAL_STATE);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const approvalResolveRef = useRef<((v: boolean) => void) | null>(null);

  const start = useCallback((goal: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState({ ...INITIAL_STATE, running: true });

    runAgentLoop(goal, {
      onStep: (s) => setState({ ...s }),
      onApproval: async (toolName, args) => {
        if (autonomousMode) return true;
        // Wait for user to approve/reject
        return new Promise<boolean>((resolve) => {
          approvalResolveRef.current = resolve;
        });
      },
      abortSignal: ac.signal,
    }).then((finalState) => {
      setState(finalState);
      // Save transcript to command_messages
      saveTranscript(goal, finalState.transcript);
    }).catch((e) => {
      setState((prev) => ({ ...prev, running: false, error: e.message }));
    });
  }, [autonomousMode]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, running: false, finished: true }));
  }, []);

  const approveStep = useCallback(() => {
    approvalResolveRef.current?.(true);
    approvalResolveRef.current = null;
  }, []);

  const rejectStep = useCallback(() => {
    approvalResolveRef.current?.(false);
    approvalResolveRef.current = null;
  }, []);

  return { state, start, stop, approveStep, rejectStep, autonomousMode, setAutonomousMode };
}

/**
 * Save agent transcript to command_messages.
 */
async function saveTranscript(goal: string, transcript: AgentStep[]) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Save as a single summary message
    const summary = {
      conversation_id: crypto.randomUUID(),
      role: "tool",
      content: JSON.stringify({
        type: "agent_transcript",
        goal,
        steps: transcript.map((s) => ({
          step: s.stepNumber,
          tool: s.toolName,
          args: s.args,
          success: s.result.success,
        })),
      }),
    };
    await supabase.from("command_messages").insert(summary);
  } catch {
    // Non-critical — don't break the agent
  }
}

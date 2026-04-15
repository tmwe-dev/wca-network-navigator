/**
 * useAgentLoop — hook for running the multi-step agent loop from CommandPage.
 */
import { useState, useRef, useCallback } from "react";
import { runAgentLoop, type AgentState, type AgentStep } from "@/v2/agent/runtime/agentLoop";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { Sentry } from "@/lib/sentry";

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
      // Sentry: capture agent loop error with transcript context
      Sentry.captureException(e, {
        tags: { "agent.goal": goal.slice(0, 100) },
        extra: { transcript: state.transcript.map((s) => ({ tool: s.toolName, success: s.result.success })) },
      } as Record<string, unknown>);
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

    const conversationId = crypto.randomUUID();

    // Save as a single summary message
    const summary = {
      conversation_id: conversationId,
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

    // Save each step to agent_action_log for audit
    const logEntries = transcript.map((s) => ({
      user_id: user.id,
      conversation_id: conversationId,
      tool_name: s.toolName,
      args: s.args ?? {},
      result: { success: s.result.success, error: s.result.error ?? null },
    }));

    if (logEntries.length > 0) {
      await untypedFrom("agent_action_log").insert(logEntries);
    }
  } catch {
    // Non-critical — don't break the agent
  }
}

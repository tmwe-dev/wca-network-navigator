/**
 * agentLoop.ts — Multi-step agent loop runtime.
 * Ported from wca-test-runner/agent.js concept.
 * Client orchestrates: calls edge for AI decision, executes DOM tools locally.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AgentTool, AgentToolResult } from "./tools";
import { AGENT_TOOLS } from "./tools";
import { isForbidden } from "./safety";

export const MAX_STEPS = 80;
const MAX_CONTEXT_MESSAGES = 30;
const LOOP_DETECTION_THRESHOLD = 3;

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface AgentStep {
  stepNumber: number;
  toolName: string;
  args: Record<string, unknown>;
  result: AgentToolResult;
  timestamp: number;
}

export interface AgentState {
  running: boolean;
  step: number;
  transcript: AgentStep[];
  lastResult: AgentToolResult | null;
  error: string | null;
  finished: boolean;
  finalAnswer: string | null;
}

export type AgentStepCallback = (state: AgentState) => void;
export type ApprovalCallback = (toolName: string, args: Record<string, unknown>) => Promise<boolean>;

/**
 * Trims conversation context to last N messages, keeping system prompt.
 */
function trimContext(messages: AgentMessage[]): AgentMessage[] {
  if (messages.length <= MAX_CONTEXT_MESSAGES) return messages;
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  return [...system, ...rest.slice(-MAX_CONTEXT_MESSAGES)];
}

/**
 * Detects if the agent is in a loop (same tool+args called N times).
 */
function detectLoop(transcript: AgentStep[]): boolean {
  if (transcript.length < LOOP_DETECTION_THRESHOLD) return false;
  const last = transcript.slice(-LOOP_DETECTION_THRESHOLD);
  const sig = last.map((s) => `${s.toolName}:${JSON.stringify(s.args)}`);
  return sig.every((s) => s === sig[0]);
}

/**
 * Retry wrapper — retries a function up to N times with delay.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error("withRetry: unreachable");
}

/**
 * Calls the agent-loop edge function for one iteration.
 */
async function callAgentEdge(
  goal: string,
  history: AgentMessage[],
  sessionContext?: Record<string, unknown>,
): Promise<{ message: string; toolCalls?: Array<{ name: string; arguments: Record<string, unknown>; id: string }> }> {
  const trimmed = trimContext(history);

  const { data, error } = await supabase.functions.invoke("agent-loop", {
    body: { goal, history: trimmed, sessionContext },
  });

  if (error) throw new Error(`agent-loop edge error: ${error.message}`);
  return data as { message: string; toolCalls?: Array<{ name: string; arguments: Record<string, unknown>; id: string }> };
}

/**
 * Runs the full agent loop.
 */
export async function runAgentLoop(
  goal: string,
  options: {
    onStep: AgentStepCallback;
    onApproval: ApprovalCallback;
    abortSignal: AbortSignal;
    sessionContext?: Record<string, unknown>;
  },
): Promise<AgentState> {
  const { onStep, onApproval, abortSignal, sessionContext } = options;
  const toolMap = new Map<string, AgentTool>(AGENT_TOOLS.map((t) => [t.name, t]));

  const history: AgentMessage[] = [];
  const transcript: AgentStep[] = [];
  let step = 0;
  let finished = false;
  let finalAnswer: string | null = null;
  let lastError: string | null = null;

  const buildState = (): AgentState => ({
    running: !finished && !abortSignal.aborted,
    step,
    transcript,
    lastResult: transcript.length > 0 ? transcript[transcript.length - 1].result : null,
    error: lastError,
    finished,
    finalAnswer,
  });

  while (step < MAX_STEPS && !finished && !abortSignal.aborted) {
    step++;

    // Loop detection
    if (detectLoop(transcript)) {
      history.push({
        role: "system",
        content: "⚠️ LOOP DETECTED: Hai chiamato lo stesso tool con gli stessi argomenti 3 volte. CAMBIA STRATEGIA. Prova un approccio diverso o usa un tool differente.",
      });
    }

    try {
      const response = await withRetry(() => callAgentEdge(goal, history, sessionContext));

      // Add assistant message
      history.push({ role: "assistant", content: response.message });

      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Agent finished with a final answer
        finished = true;
        finalAnswer = response.message;
        onStep(buildState());
        break;
      }

      // Execute each tool call
      for (const tc of response.toolCalls) {
        if (abortSignal.aborted) break;

        // Safety check
        if (isForbidden(tc.name, tc.arguments)) {
          const result: AgentToolResult = { success: false, error: "Azione bloccata da safety filter" };
          transcript.push({ stepNumber: step, toolName: tc.name, args: tc.arguments, result, timestamp: Date.now() });
          history.push({ role: "tool", content: JSON.stringify(result), tool_call_id: tc.id, name: tc.name });
          continue;
        }

        const tool = toolMap.get(tc.name);
        if (!tool) {
          const result: AgentToolResult = { success: false, error: `Tool sconosciuto: ${tc.name}` };
          transcript.push({ stepNumber: step, toolName: tc.name, args: tc.arguments, result, timestamp: Date.now() });
          history.push({ role: "tool", content: JSON.stringify(result), tool_call_id: tc.id, name: tc.name });
          continue;
        }

        // Approval for write tools
        if (tool.requiresApproval) {
          const approved = await onApproval(tc.name, tc.arguments);
          if (!approved) {
            const result: AgentToolResult = { success: false, error: "Azione annullata dall'utente" };
            transcript.push({ stepNumber: step, toolName: tc.name, args: tc.arguments, result, timestamp: Date.now() });
            history.push({ role: "tool", content: JSON.stringify(result), tool_call_id: tc.id, name: tc.name });
            continue;
          }
        }

        // Execute with timeout
        const timeoutPromise = new Promise<AgentToolResult>((_, reject) =>
          setTimeout(() => reject(new Error("Tool timeout (25s)")), 25_000),
        );
        const execPromise = tool.execute(tc.arguments);
        const result = await Promise.race([execPromise, timeoutPromise]).catch(
          (e: Error): AgentToolResult => ({ success: false, error: e.message }),
        );

        transcript.push({ stepNumber: step, toolName: tc.name, args: tc.arguments, result, timestamp: Date.now() });
        history.push({ role: "tool", content: JSON.stringify(result).slice(0, 4000), tool_call_id: tc.id, name: tc.name });
      }

      onStep(buildState());
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      onStep(buildState());

      // Add error to history so AI can recover
      history.push({ role: "system", content: `Errore step ${step}: ${lastError}. Riprova con approccio diverso.` });
    }
  }

  if (step >= MAX_STEPS) {
    lastError = `Limite massimo di ${MAX_STEPS} step raggiunto`;
    finished = true;
  }

  return buildState();
}

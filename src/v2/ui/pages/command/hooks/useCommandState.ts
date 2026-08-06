/**
 * useCommandState — centralized state for CommandPage.
 * No mock scenarios anymore; tracks the live tool currently running for the activation bar.
 */
import { useState, useRef, useCallback, useReducer } from "react";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import type { ToolResult } from "../tools/types";
import type { PlanExecutionState } from "../planRunner";
import type { Message, CanvasType, ToolPhase, FlowPhase } from "../constants";
import type { QueryContext } from "../lib/queryContext";
import { phaseReducer, INITIAL_PHASE } from "./phaseFsm";

export function useCommandState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [lang, setLang] = useState<"it" | "en">("it");
  const [canvas, setCanvas] = useState<CanvasType>(null);
  // FSM-backed phase quintet — invarianti in phaseFsm.ts.
  const [phase, phaseDispatch] = useReducer(phaseReducer, INITIAL_PHASE);
  const { flowPhase, showTools, toolPhase, chainHighlight, activeToolKey } = phase;
  // Ref sincronizzato — supporta updater funzionali su setChainHighlight
  const chainHighlightRef = useRef<number | undefined>(undefined);
  chainHighlightRef.current = chainHighlight;
  const setFlowPhase = useCallback((v: FlowPhase) => phaseDispatch({ type: "SET_FLOW", value: v }), []);
  const setShowTools = useCallback((v: boolean) => phaseDispatch({ type: "SET_SHOW_TOOLS", value: v }), []);
  const setToolPhase = useCallback((v: ToolPhase) => phaseDispatch({ type: "SET_TOOL_PHASE", value: v }), []);
  const setChainHighlight = useCallback(
    (v: number | undefined | ((prev: number | undefined) => number | undefined)) =>
      phaseDispatch({
        type: "SET_CHAIN",
        value:
          typeof v === "function" ? (v as (p: number | undefined) => number | undefined)(chainHighlightRef.current) : v,
      }),
    [],
  );
  const setActiveToolKey = useCallback((v: string | null) => phaseDispatch({ type: "SET_ACTIVE_TOOL", value: v }), []);
  const [execProgress, setExecProgress] = useState(0);
  const [execSteps, setExecSteps] = useState<ExecutionStep[]>([]);
  const [liveResult, setLiveResult] = useState<ToolResult | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    toolId: string;
    payload: Record<string, unknown>;
    prompt: string;
  } | null>(null);
  const [planState, setPlanState] = useState<PlanExecutionState | null>(null);
  /** Selected row IDs (for selectable canvases) */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Last successful query "shape" — enables follow-up queries like "e a New York?" */
  const [queryContext, setQueryContext] = useState<QueryContext | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0;

  const ts = () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const resetForNewMessage = useCallback(() => {
    setCanvas(null);
    setVoiceSpeaking(false);
    setLiveResult(null);
    setPlanState(null);
    setSelectedIds(new Set());
    phaseDispatch({ type: "RESET" });
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    voiceSpeaking,
    setVoiceSpeaking,
    inputFocused,
    setInputFocused,
    lang,
    setLang,
    canvas,
    setCanvas,
    flowPhase,
    setFlowPhase,
    activeToolKey,
    setActiveToolKey,
    showTools,
    setShowTools,
    toolPhase,
    setToolPhase,
    chainHighlight,
    setChainHighlight,
    execProgress,
    setExecProgress,
    execSteps,
    setExecSteps,
    liveResult,
    setLiveResult,
    pendingApproval,
    setPendingApproval,
    planState,
    setPlanState,
    selectedIds,
    setSelectedIds,
    toggleSelected,
    selectAll,
    clearSelection,
    queryContext,
    setQueryContext,
    chatEndRef,
    isEmpty,
    ts,
    addMessage,
    resetForNewMessage,
  };
}

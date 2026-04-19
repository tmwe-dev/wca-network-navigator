/**
 * useCommandState — centralized state for CommandPage.
 * No mock scenarios anymore; tracks the live tool currently running for the activation bar.
 */
import { useState, useRef, useCallback } from "react";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import type { ToolResult } from "../tools/types";
import type { PlanExecutionState } from "../planRunner";
import type { Message, CanvasType, FlowPhase, ToolPhase } from "../constants";

export function useCommandState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [lang, setLang] = useState<"it" | "en">("it");
  const [canvas, setCanvas] = useState<CanvasType>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  /** Active tool id (for ToolActivationBar + governance), e.g. "partner-search" */
  const [activeToolKey, setActiveToolKey] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [toolPhase, setToolPhase] = useState<ToolPhase>("active");
  const [chainHighlight, setChainHighlight] = useState<number | undefined>(undefined);
  const [execProgress, setExecProgress] = useState(0);
  const [execSteps, setExecSteps] = useState<ExecutionStep[]>([]);
  const [liveResult, setLiveResult] = useState<ToolResult | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{ toolId: string; payload: Record<string, unknown>; prompt: string } | null>(null);
  const [planState, setPlanState] = useState<PlanExecutionState | null>(null);
  /** Selected row IDs (for selectable canvases) */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    setFlowPhase("idle");
    setShowTools(false);
    setVoiceSpeaking(false);
    setChainHighlight(undefined);
    setLiveResult(null);
    setPlanState(null);
    setActiveToolKey(null);
    setSelectedIds(new Set());
  }, []);

  return {
    messages, setMessages,
    input, setInput,
    voiceSpeaking, setVoiceSpeaking,
    inputFocused, setInputFocused,
    lang, setLang,
    canvas, setCanvas,
    flowPhase, setFlowPhase,
    activeToolKey, setActiveToolKey,
    showTools, setShowTools,
    toolPhase, setToolPhase,
    chainHighlight, setChainHighlight,
    execProgress, setExecProgress,
    execSteps, setExecSteps,
    liveResult, setLiveResult,
    pendingApproval, setPendingApproval,
    planState, setPlanState,
    selectedIds, setSelectedIds, toggleSelected, selectAll, clearSelection,
    chatEndRef,
    isEmpty,
    ts,
    addMessage,
    resetForNewMessage,
  };
}

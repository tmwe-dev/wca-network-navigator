/**
 * useCommandState — centralized state for CommandPage.
 * Extracted from CommandPage.tsx.
 */
import { useState, useRef, useCallback } from "react";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import type { ToolResult } from "../tools/types";
import type { PlanExecutionState } from "../planRunner";
import type { Message, CanvasType, FlowPhase, ToolPhase, Scenario } from "../constants";

export function useCommandState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [lang, setLang] = useState<"it" | "en">("it");
  const [canvas, setCanvas] = useState<CanvasType>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [activeScenarioKey, setActiveScenarioKey] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [toolPhase, setToolPhase] = useState<ToolPhase>("active");
  const [chainHighlight, setChainHighlight] = useState<number | undefined>(undefined);
  const [execProgress, setExecProgress] = useState(0);
  const [execSteps, setExecSteps] = useState<ExecutionStep[]>([]);
  const [liveResult, setLiveResult] = useState<ToolResult | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{ toolId: string; payload: Record<string, unknown>; prompt: string } | null>(null);
  const [planState, setPlanState] = useState<PlanExecutionState | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0;

  const ts = () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);
  }, []);

  const resetForNewMessage = useCallback(() => {
    setCanvas(null);
    setFlowPhase("idle");
    setShowTools(false);
    setVoiceSpeaking(false);
    setChainHighlight(undefined);
    setLiveResult(null);
    setPlanState(null);
  }, []);

  return {
    messages, setMessages,
    input, setInput,
    voiceSpeaking, setVoiceSpeaking,
    inputFocused, setInputFocused,
    lang, setLang,
    canvas, setCanvas,
    flowPhase, setFlowPhase,
    activeScenario, setActiveScenario,
    activeScenarioKey, setActiveScenarioKey,
    showTools, setShowTools,
    toolPhase, setToolPhase,
    chainHighlight, setChainHighlight,
    execProgress, setExecProgress,
    execSteps, setExecSteps,
    liveResult, setLiveResult,
    pendingApproval, setPendingApproval,
    planState, setPlanState,
    chatEndRef,
    isEmpty,
    ts,
    addMessage,
    resetForNewMessage,
  };
}

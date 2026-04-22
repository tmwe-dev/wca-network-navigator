import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ToolResult } from "../tools/types";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";

export type CanvasType =
  | "table"
  | "campaign"
  | "report"
  | "result"
  | "live-table"
  | "live-card-grid"
  | "live-timeline"
  | "live-flow"
  | "live-composer"
  | "live-approval"
  | "live-report"
  | "live-result"
  | null;
export type FlowPhase =
  | "idle"
  | "thinking"
  | "proposal"
  | "approval"
  | "executing"
  | "done";
export type ToolPhase = "activating" | "active" | "done";

interface ApprovalState {
  toolId: string;
  payload: Record<string, unknown>;
  prompt: string;
}

export function useCommandPageState() {
  const nav = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [lang, setLang] = useState<"it" | "en">("it");
  const [canvas, setCanvas] = useState<CanvasType>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [activeScenario, setActiveScenario] = useState<any | null>(null);
  const [activeScenarioKey, setActiveScenarioKey] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [toolPhase, setToolPhase] = useState<ToolPhase>("active");
  const [chainHighlight, setChainHighlight] = useState<number | undefined>(
    undefined
  );
  const [execProgress, setExecProgress] = useState(0);
  const [execSteps, setExecSteps] = useState<ExecutionStep[]>([]);
  const [liveResult, setLiveResult] = useState<ToolResult | null>(null);
  const [pendingApproval, setPendingApproval] = useState<ApprovalState | null>(
    null
  );
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ts = () =>
    new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const addMessage = useCallback((msg: Omit<any, "id">) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: Date.now() + Math.random() },
    ]);
  }, []);

  const resetFlow = useCallback(() => {
    setFlowPhase("idle");
    setCanvas(null);
    setShowTools(false);
    setChainHighlight(undefined);
    setLiveResult(null);
    setPendingApproval(null);
  }, []);

  const resetForNewMessage = useCallback(() => {
    setInput("");
    setCanvas(null);
    setFlowPhase("idle");
    setShowTools(false);
    setVoiceSpeaking(false);
    setChainHighlight(undefined);
    setLiveResult(null);
  }, []);

  return {
    // State
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
    activeScenario,
    setActiveScenario,
    activeScenarioKey,
    setActiveScenarioKey,
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
    chatEndRef,

    // Utils
    ts,
    addMessage,
    resetFlow,
    resetForNewMessage,
  };
}

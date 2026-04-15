/**
 * CommandThread — message list + approval panels + execution flow.
 */
import { type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2 } from "lucide-react";
import AiEntity from "@/components/ai/AiEntity";
import ApprovalPanel from "@/components/workspace/ApprovalPanel";
import ExecutionFlow, { type ExecutionStep } from "@/components/workspace/ExecutionFlow";
import ToolActivationBar from "@/components/workspace/ToolActivationBar";
import { TOOLS } from "../tools/registry";
import type { Message, FlowPhase, ToolPhase, Scenario } from "../constants";
import type { PlanExecutionState } from "../planRunner";
import PlanTimeline from "./PlanTimeline";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface Props {
  messages: Message[];
  activeScenarioKey: string | null;
  showTools: boolean;
  flowPhase: FlowPhase;
  toolPhase: ToolPhase;
  chainHighlight: number | undefined;
  activeScenario: Scenario | null;
  planState: PlanExecutionState | null;
  execSteps: ExecutionStep[];
  execProgress: number;
  governance: { role: string; permission: string; policy: string };
  chatEndRef: RefObject<HTMLDivElement>;
  onApprove: () => void;
  onCancel: () => void;
  onApproveStep?: (stepNumber: number) => void;
}

export default function CommandThread({
  messages, activeScenarioKey, showTools, flowPhase, toolPhase, chainHighlight,
  activeScenario, planState, execSteps, execProgress, governance, chatEndRef,
  onApprove, onCancel, onApproveStep,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-xl mx-auto space-y-6">
        <ToolActivationBar
          scenarioKey={activeScenarioKey}
          visible={showTools && flowPhase !== "idle"}
          phase={toolPhase}
          chainHighlight={chainHighlight}
        />

        {messages.map((msg) => (
          <AnimatePresence key={msg.id}>
            {msg.thinking ? (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4, ease }} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1"><AiEntity size="sm" /></div>
                <div className="flex items-center gap-2 px-5 py-4">
                  {[0, 1, 2].map((dot) => (
                    <motion.div key={dot} className="w-1.5 h-1.5 rounded-full bg-primary/95" animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 }} />
                  ))}
                  <span className="text-[11px] text-muted-foreground/100 ml-2 font-light">Attivo tool operativi...</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease }}
                className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1"><AiEntity size="sm" pulse={false} /></div>
                )}
                <motion.div
                  className={`max-w-[85%] relative ${msg.role === "user" ? "px-5 py-4 rounded-2xl rounded-br-lg" : "px-5 py-4 rounded-2xl rounded-bl-lg"}`}
                  style={{
                    background: msg.role === "assistant" ? "hsl(240 5% 6% / 0.7)" : "hsl(240 5% 8% / 0.65)",
                    border: `1px solid hsl(0 0% 100% / ${msg.role === "assistant" ? "0.16" : "0.12"})`,
                    backdropFilter: "blur(40px)",
                    boxShadow: msg.role === "assistant" ? "0 0 60px hsl(210 100% 66% / 0.1), 0 20px 50px -20px hsl(0 0% 0% / 0.94)" : "none",
                  }}
                >
                  {msg.agentName && (
                    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="text-[10px] text-primary/100 font-mono mb-2.5 tracking-[0.2em] uppercase">
                      {msg.agentName}
                    </motion.div>
                  )}
                  <div className="text-[14px] leading-[1.7] whitespace-pre-line font-light text-foreground/100">
                    {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <span key={i} className="text-primary/92 font-mono text-[12px]">{part.slice(2, -2)}</span>
                        : <span key={i}>{part}</span>
                    )}
                  </div>
                  {msg.meta && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-2 mt-3 pt-2 border-t border-border/[0.16]">
                      <Wand2 className="w-2.5 h-2.5 text-primary/92" />
                      <span className="text-[10px] text-muted-foreground/100 font-light font-mono">{msg.meta}</span>
                    </motion.div>
                  )}
                  {msg.governance && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-2 mt-1.5">
                      <div className="w-1 h-1 rounded-full bg-success/90" />
                      <span className="text-[9px] text-muted-foreground/100 font-mono">{msg.governance}</span>
                    </motion.div>
                  )}
                  <span className="text-[10px] text-muted-foreground/100 mt-2 block">{msg.timestamp}</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}

        {activeScenario?.approval && (flowPhase === "proposal" || flowPhase === "approval") && !planState && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <ApprovalPanel
              visible
              title={activeScenario.approval.title}
              description={activeScenario.approval.description}
              details={activeScenario.approval.details}
              governance={activeScenario.approval.governance}
              onApprove={onApprove}
              onModify={() => {}}
              onCancel={onCancel}
            />
          </motion.div>
        )}

        {planState?.status === "awaiting-approval" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <ApprovalPanel
              visible
              title="Conferma piano"
              description={planState.summary}
              details={planState.steps.map((s) => ({
                label: `Step ${s.stepNumber} · ${TOOLS.find((t) => t.id === s.toolId)?.label ?? s.toolId}`,
                value: s.reasoning,
              }))}
              governance={{ role: governance.role, permission: "EXECUTE:PLAN", policy: governance.policy }}
              onApprove={onApprove}
              onModify={() => {}}
              onCancel={() => onCancel()}
            />
          </motion.div>
        )}

        <ExecutionFlow visible={flowPhase === "executing"} steps={execSteps} progress={execProgress} />

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

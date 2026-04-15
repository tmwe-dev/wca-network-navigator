import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, AlertTriangle, Home, MessageSquare, Sparkles, Cpu, Box, Plug, Layers, Zap, Shield, Settings } from "lucide-react";
import AiEntity from "@/design-system/AiEntity";
import ExecutionFlow from "@/design-system/ExecutionFlow";
import ApprovalPanel from "@/design-system/ApprovalPanel";
import CanvasShell from "@/design-system/CanvasShell";
import VoicePresence from "@/design-system/VoicePresence";
import FloatingDock, { type DockItem } from "@/design-system/FloatingDock";
import TableCanvas from "./command/canvas/TableCanvas";
import CardGridCanvas from "./command/canvas/CardGridCanvas";
import TimelineCanvas from "./command/canvas/TimelineCanvas";
import FlowCanvas from "./command/canvas/FlowCanvas";
import AgentDots from "./command/AgentDots";
import { useCommandFlow, type CommandPhase } from "./command/useCommandFlow";
import { useGovernance } from "./command/hooks/useGovernance";

const ease = [0.2, 0.8, 0.2, 1] as const;

const quickPrompts = [
  "Mostra i partner WCA attivi in Europa",
  "Prepara follow-up per clienti inattivi >30gg",
  "Report performance agenti ultima settimana",
  "Lancia campagna re-engagement Francia",
];

const phaseTitle: Record<CommandPhase, string> = {
  idle: "Cosa facciamo oggi?",
  thinking: "Sto pensando…",
  proposal: "Ecco cosa propongo",
  executing: "Sto eseguendo",
  done: "Fatto",
  error: "Qualcosa è andato storto",
};

const phaseSubtitle: Record<CommandPhase, string> = {
  idle: "Chiedi qualsiasi cosa al network.",
  thinking: "",
  proposal: "",
  executing: "",
  done: "",
  error: "",
};

const dockItems: DockItem[] = [
  { to: "/v2/dashboard", icon: <Home className="w-4 h-4" /> },
  { to: "/v2/command", icon: <MessageSquare className="w-4 h-4" /> },
  { to: "/v2/agents", icon: <Sparkles className="w-4 h-4" /> },
  { to: "/v2/engine", icon: <Cpu className="w-4 h-4" /> },
  { to: "/v2/architecture", icon: <Box className="w-4 h-4" /> },
  { to: "/v2/connections", icon: <Plug className="w-4 h-4" /> },
  { to: "/v2/templates", icon: <Layers className="w-4 h-4" /> },
  { to: "/v2/automations", icon: <Zap className="w-4 h-4" /> },
  { to: "/v2/audit", icon: <Shield className="w-4 h-4" /> },
  { to: "/v2/settings", icon: <Settings className="w-4 h-4" /> },
];

export function CommandPage() {
  const {
    phase, scenario, executionSteps, executionProgress, thinkingLabel,
    toolResult, isLive, errorMessage, submit, approve, cancel, reset,
  } = useCommandFlow();

  const governance = useGovernance(scenario?.key);
  const [inputValue, setInputValue] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [heroCompact, setHeroCompact] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compact hero when not idle
  useEffect(() => {
    setHeroCompact(phase !== "idle");
  }, [phase]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [inputValue]);

  const handleSubmit = useCallback(() => {
    if (phase !== "idle" || !inputValue.trim()) return;
    submit(inputValue.trim());
    setInputValue("");
  }, [phase, inputValue, submit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Render the correct canvas variant for mock scenarios
  const renderMockCanvas = () => {
    if (!scenario) return null;

    if (scenario.canvasType === "card-grid" && scenario.cardGridData) {
      return <CardGridCanvas items={scenario.cardGridData} />;
    }
    if (scenario.canvasType === "timeline" && scenario.timelineData) {
      return <TimelineCanvas events={scenario.timelineData.events} kpis={scenario.timelineData.kpis} />;
    }
    if (scenario.canvasType === "flow" && scenario.flowData) {
      return <FlowCanvas nodes={scenario.flowData.nodes} title={scenario.flowData.title} />;
    }
    if (scenario.canvasType === "table" && scenario.canvasData) {
      return (
        <TableCanvas
          columns={scenario.canvasData.headers.map((h, i) => ({ key: String(i), label: h }))}
          rows={scenario.canvasData.rows.map((r) => {
            const obj: Record<string, string> = {};
            r.cells.forEach((c, i) => { obj[String(i)] = c; });
            return obj;
          })}
          kpis={[
            { label: "Partner trovati", value: String(scenario.canvasData.rows.length) },
            { label: "Inattività media", value: "60gg" },
            { label: "Priorità alta", value: "4" },
          ]}
        />
      );
    }
    return null;
  };

  // Render live tool result
  const renderLiveCanvas = () => {
    if (!toolResult) return null;
    return (
      <TableCanvas
        columns={toolResult.columns}
        rows={toolResult.rows}
        isLive
        meta={toolResult.meta}
      />
    );
  };

  return (
    <div className="dark h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Agent dots — top right */}
      <div className="absolute top-4 right-4 z-30">
        <AgentDots />
      </div>

      {/* Hero Section */}
      <AnimatePresence mode="wait">
        {!heroCompact ? (
          <motion.div
            key="hero-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.98 }}
            transition={{ duration: 0.6, ease }}
            className="flex flex-col items-center justify-center pt-8 pb-4 px-4 md:pt-16 md:pb-8"
            style={{ minHeight: "35vh" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease }}
            >
              <AiEntity size="hero" phase={phase} className="hidden md:flex" />
              <AiEntity size="lg" phase={phase} className="flex md:hidden" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease }}
              className="text-3xl md:text-5xl font-light tracking-[-0.04em] text-center mt-6 text-gradient-hero"
            >
              {phaseTitle[phase]}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-[12px] text-muted-foreground mt-2 tracking-wide"
            >
              {phaseSubtitle[phase]}
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="hero-compact"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease }}
            className="flex items-center gap-4 px-6 py-3"
          >
            <AiEntity size="sm" phase={phase} />
            <div>
              <motion.h2
                key={phase}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-lg font-light tracking-[-0.03em] text-gradient-hero"
              >
                {phaseTitle[phase]}
              </motion.h2>
              {phase === "thinking" && (
                <motion.span
                  key={thinkingLabel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-muted-foreground font-mono tracking-wider"
                >
                  {thinkingLabel}
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Presence */}
      <AnimatePresence>
        {voiceActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 md:px-8"
          >
            <div className="max-w-3xl mx-auto">
              <VoicePresence active listening />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Middle: Dynamic Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {/* THINKING */}
            {phase === "thinking" && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.5, ease }}
              >
                <ExecutionFlow visible steps={[{ label: thinkingLabel, status: "running" }]} />
              </motion.div>
            )}

            {/* PROPOSAL */}
            {phase === "proposal" && scenario && (
              <motion.div
                key="proposal"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.6, ease }}
                className="space-y-4"
              >
                <CanvasShell onClose={cancel} title={scenario.canvasData?.title ?? `${scenario.canvasType.toUpperCase()} · PROPOSTA`}>
                  {renderMockCanvas()}
                </CanvasShell>

                {scenario.approvalPayload && (
                  <ApprovalPanel
                    visible
                    title={scenario.approvalPayload.title}
                    description={scenario.approvalPayload.description}
                    details={scenario.approvalPayload.details}
                    governance={governance}
                    onApprove={approve}
                    onModify={() => {}}
                    onCancel={cancel}
                  />
                )}
              </motion.div>
            )}

            {/* EXECUTING */}
            {phase === "executing" && (
              <motion.div
                key="executing"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.6, ease }}
                className="space-y-4"
              >
                {!isLive && scenario && (
                  <div className="opacity-30 pointer-events-none">
                    <CanvasShell onClose={() => {}} title={scenario.canvasData?.title ?? "ESECUZIONE"}>
                      {renderMockCanvas()}
                    </CanvasShell>
                  </div>
                )}
                <ExecutionFlow visible steps={executionSteps} progress={executionProgress} />
              </motion.div>
            )}

            {/* DONE */}
            {phase === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.6, ease }}
              >
                {isLive && toolResult ? (
                  <CanvasShell onClose={reset} title={toolResult.title}>
                    {renderLiveCanvas()}
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={reset}
                      className="pill mt-4"
                    >
                      Nuovo comando
                    </motion.button>
                  </CanvasShell>
                ) : scenario ? (
                  <CanvasShell onClose={reset} title="ESECUZIONE · COMPLETATA">
                    <div className="space-y-6">
                      {/* Canvas result based on type */}
                      {scenario.canvasType === "timeline" && scenario.timelineData ? (
                        <TimelineCanvas events={scenario.timelineData.events} kpis={scenario.timelineData.kpis} />
                      ) : (
                        <>
                          <p className="text-[13px] font-light text-foreground leading-relaxed">{scenario.resultPayload.message}</p>
                          <div className="grid grid-cols-3 gap-3">
                            {scenario.resultPayload.kpis.map((kpi, i) => (
                              <motion.div
                                key={kpi.label}
                                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease }}
                                className="float-panel-subtle p-4 rounded-xl text-center"
                              >
                                <div className="text-2xl font-extralight tracking-tight text-gradient-primary">{kpi.value}</div>
                                <div className="text-[9px] text-muted-foreground mt-1.5 tracking-wider uppercase">{kpi.label}</div>
                              </motion.div>
                            ))}
                          </div>
                        </>
                      )}

                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={reset}
                        className="pill mt-4"
                      >
                        Nuovo comando
                      </motion.button>
                    </div>
                  </CanvasShell>
                ) : null}
              </motion.div>
            )}

            {/* ERROR */}
            {phase === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease }}
                className="space-y-4"
              >
                <ExecutionFlow visible steps={executionSteps} progress={executionProgress} />
                <CanvasShell onClose={reset} title="ERRORE">
                  <div className="py-8 text-center space-y-3">
                    <AlertTriangle className="w-6 h-6 text-destructive/60 mx-auto" />
                    <p className="text-[12px] text-muted-foreground font-light">{errorMessage ?? "Nessun dato disponibile — riprova"}</p>
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={reset}
                      className="pill mt-2"
                    >
                      Riprova
                    </motion.button>
                  </div>
                </CanvasShell>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom: Input Area */}
      <div className="fixed bottom-16 left-0 right-0 px-4 md:px-8 pb-2 z-40">
        <div className="max-w-3xl mx-auto">
          <div className="float-panel flex items-end gap-2 p-3">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={phase !== "idle"}
              rows={1}
              placeholder="Dimmi cosa fare — es. mostrami i partner spedizionieri in Germania inattivi da 60 giorni"
              className="flex-1 bg-transparent border-none outline-none resize-none text-[13px] font-light text-foreground placeholder:text-muted-foreground/50 disabled:opacity-40"
              style={{ maxHeight: 120, minHeight: 24 }}
            />
            <div className="flex items-center gap-1.5 flex-shrink-0 pb-0.5">
              <motion.button
                whileHover={phase === "idle" ? { scale: 1.05 } : {}}
                whileTap={phase === "idle" ? { scale: 0.95 } : {}}
                onClick={handleSubmit}
                disabled={phase !== "idle" || !inputValue.trim()}
                className="p-2 rounded-xl text-primary disabled:text-muted-foreground/20 disabled:cursor-not-allowed transition-colors duration-300 hover:bg-primary/10"
              >
                <Send className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setVoiceActive((v) => !v)}
                className={`p-2 rounded-xl transition-colors duration-300 ${
                  voiceActive ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
              >
                <Mic className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Quick Prompts */}
          <AnimatePresence>
            {phase === "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.3, ease }}
                className="flex flex-wrap gap-2 mt-3 justify-center"
              >
                {quickPrompts.map((prompt, i) => (
                  <motion.button
                    key={prompt}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06, duration: 0.3, ease }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setInputValue(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="pill text-[10px] hover:bg-primary/10 transition-colors duration-500"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Dock */}
      <FloatingDock items={dockItems} />
    </div>
  );
}

export default CommandPage;

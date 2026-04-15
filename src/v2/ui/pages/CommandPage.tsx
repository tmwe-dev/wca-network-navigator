import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, AlertTriangle } from "lucide-react";
import AiEntity from "@/design-system/AiEntity";
import ExecutionFlow from "@/design-system/ExecutionFlow";
import ApprovalPanel from "@/design-system/ApprovalPanel";
import CanvasShell from "@/design-system/CanvasShell";
import { useCommandFlow, type CommandPhase } from "./command/useCommandFlow";

const ease = [0.2, 0.8, 0.2, 1] as const;

const quickPrompts = [
  "Mostra i partner WCA attivi in Europa",
  "Prepara follow-up per clienti inattivi >30gg",
  "Report performance agenti ultima settimana",
];

const phaseTitle: Record<CommandPhase, string> = {
  idle: "Cosa vuoi fare?",
  thinking: "Sto pensando…",
  proposal: "Ecco cosa propongo",
  executing: "Sto eseguendo",
  done: "Fatto",
  error: "Qualcosa è andato storto",
};

export function CommandPage() {
  const {
    phase,
    scenario,
    executionSteps,
    executionProgress,
    thinkingLabel,
    toolResult,
    isLive,
    errorMessage,
    submit,
    approve,
    cancel,
    reset,
  } = useCommandFlow();

  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Render live tool result canvas
  const renderLiveCanvas = () => {
    if (!toolResult) return null;
    const { columns, rows, meta, title } = toolResult;

    if (rows.length === 0) {
      return (
        <CanvasShell onClose={reset} title={title}>
          <div className="py-12 text-center">
            <p className="text-[13px] text-muted-foreground font-light">Nessun partner trovato per questa ricerca.</p>
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} onClick={reset} className="pill mt-4">
              Nuovo comando
            </motion.button>
          </div>
        </CanvasShell>
      );
    }

    return (
      <CanvasShell onClose={reset} title={title}>
        <div className="space-y-3">
          {/* Badge + meta */}
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-success/20 text-success">
              LIVE
            </span>
            {meta && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {meta.count} partner trovati · {meta.sourceLabel}
              </span>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[9px] text-muted-foreground font-mono tracking-wider">
                  {columns.map((col) => (
                    <th key={col.key} className="text-left pb-3 font-normal">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.03, duration: 0.3, ease }}
                    className="border-t border-border/20"
                  >
                    {columns.map((col, j) => (
                      <td
                        key={col.key}
                        className={`py-2 text-[11px] ${j === 0 ? "font-light text-foreground" : "text-muted-foreground"}`}
                      >
                        {row[col.key] != null ? String(row[col.key]) : "—"}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} onClick={reset} className="pill mt-2">
            Nuovo comando
          </motion.button>
        </div>
      </CanvasShell>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top: AI Entity + Title */}
      <div className="flex flex-col items-center justify-center pt-8 pb-4 px-4 md:pt-12 md:pb-6" style={{ minHeight: "30vh" }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease }}>
          <AiEntity size="hero" className="hidden md:flex" />
          <AiEntity size="lg" className="flex md:hidden" />
        </motion.div>

        <motion.h1
          key={phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="text-2xl md:text-4xl font-light tracking-[-0.04em] text-center mt-4 text-gradient-hero"
        >
          {phaseTitle[phase]}
        </motion.h1>

        {phase === "thinking" && (
          <motion.p key={thinkingLabel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-muted-foreground font-mono mt-3 tracking-wider">
            {thinkingLabel}
          </motion.p>
        )}
      </div>

      {/* Middle: Dynamic Content Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {/* THINKING */}
            {phase === "thinking" && (
              <motion.div key="thinking" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease }}>
                <ExecutionFlow visible steps={[{ label: thinkingLabel, status: "running" }]} />
              </motion.div>
            )}

            {/* PROPOSAL (mock only) */}
            {phase === "proposal" && scenario && (
              <motion.div key="proposal" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5, ease }} className="space-y-4">
                {scenario.canvasData && (
                  <div className="h-auto">
                    <CanvasShell onClose={cancel} title={scenario.canvasData.title}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-warning/20 text-warning">DEMO</span>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="text-[9px] text-muted-foreground font-mono tracking-wider">
                            {scenario.canvasData.headers.map((h) => (
                              <th key={h} className="text-left pb-3 font-normal">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {scenario.canvasData.rows.map((row, i) => (
                            <motion.tr key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06, duration: 0.35, ease }} className="border-t border-border/20">
                              {row.cells.map((cell, j) => (
                                <td key={j} className={`py-2.5 text-[12px] ${j === 0 ? "font-light text-foreground" : "text-muted-foreground"}`}>{cell}</td>
                              ))}
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </CanvasShell>
                  </div>
                )}
                {scenario.approvalPayload && (
                  <ApprovalPanel visible title={scenario.approvalPayload.title} description={scenario.approvalPayload.description} details={scenario.approvalPayload.details} governance={scenario.approvalPayload.governance} onApprove={approve} onModify={() => {}} onCancel={cancel} />
                )}
              </motion.div>
            )}

            {/* EXECUTING */}
            {phase === "executing" && (
              <motion.div key="executing" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5, ease }} className="space-y-4">
                {!isLive && scenario?.canvasData && (
                  <div className="opacity-40 pointer-events-none">
                    <CanvasShell onClose={() => {}} title={scenario.canvasData.title}>
                      <table className="w-full">
                        <thead>
                          <tr className="text-[9px] text-muted-foreground font-mono tracking-wider">
                            {scenario.canvasData.headers.map((h) => (
                              <th key={h} className="text-left pb-3 font-normal">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {scenario.canvasData.rows.map((row, i) => (
                            <tr key={i} className="border-t border-border/20">
                              {row.cells.map((cell, j) => (
                                <td key={j} className="py-2.5 text-[12px] text-muted-foreground">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CanvasShell>
                  </div>
                )}
                <ExecutionFlow visible steps={executionSteps} progress={executionProgress} />
              </motion.div>
            )}

            {/* DONE */}
            {phase === "done" && (
              <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5, ease }}>
                {isLive && toolResult ? (
                  renderLiveCanvas()
                ) : scenario ? (
                  <CanvasShell onClose={reset} title="ESECUZIONE · COMPLETATA">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-warning/20 text-warning">DEMO</span>
                      </div>
                      <p className="text-[13px] font-light text-foreground leading-relaxed">{scenario.resultPayload.message}</p>
                      <div className="grid grid-cols-3 gap-3">
                        {scenario.resultPayload.kpis.map((kpi, i) => (
                          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease }} className="p-4 rounded-xl text-center" style={{ background: "hsl(var(--card) / 0.7)", border: "1px solid hsl(var(--foreground) / 0.08)" }}>
                            <div className="text-2xl font-extralight tracking-tight text-foreground">{kpi.value}</div>
                            <div className="text-[9px] text-muted-foreground mt-1.5 tracking-wider uppercase">{kpi.label}</div>
                          </motion.div>
                        ))}
                      </div>
                      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} onClick={reset} className="pill mt-4">Nuovo comando</motion.button>
                    </div>
                  </CanvasShell>
                ) : null}
              </motion.div>
            )}

            {/* ERROR */}
            {phase === "error" && (
              <motion.div key="error" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5, ease }} className="space-y-4">
                <ExecutionFlow visible steps={executionSteps} progress={executionProgress} />
                <CanvasShell onClose={reset} title="ERRORE">
                  <div className="py-8 text-center space-y-3">
                    <AlertTriangle className="w-6 h-6 text-destructive/60 mx-auto" />
                    <p className="text-[12px] text-muted-foreground font-light">{errorMessage ?? "Nessun dato disponibile — riprova"}</p>
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} onClick={reset} className="pill mt-2">Riprova</motion.button>
                  </div>
                </CanvasShell>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom: Input Area */}
      <div className="flex-shrink-0 px-4 md:px-8 pb-4 md:pb-6">
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
              <motion.button whileHover={phase === "idle" ? { scale: 1.05 } : {}} whileTap={phase === "idle" ? { scale: 0.95 } : {}} onClick={handleSubmit} disabled={phase !== "idle" || !inputValue.trim()} className="p-2 rounded-xl text-primary disabled:text-muted-foreground/20 disabled:cursor-not-allowed transition-colors duration-300 hover:bg-primary/10">
                <Send className="w-4 h-4" />
              </motion.button>
              <div className="relative group">
                <button disabled className="p-2 rounded-xl text-muted-foreground/20 cursor-not-allowed">
                  <Mic className="w-4 h-4" />
                </button>
                <div className="absolute bottom-full right-0 mb-2 px-2 py-1 rounded-lg text-[9px] text-muted-foreground bg-card border border-border/30 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Voce disponibile nella prossima versione
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {phase === "idle" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.3, ease }} className="flex flex-wrap gap-2 mt-3 justify-center">
                {quickPrompts.map((prompt, i) => (
                  <motion.button key={prompt} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06, duration: 0.3, ease }} onClick={() => { setInputValue(prompt); textareaRef.current?.focus(); }} className="pill text-[10px] hover:bg-primary/10 transition-colors duration-300">
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default CommandPage;

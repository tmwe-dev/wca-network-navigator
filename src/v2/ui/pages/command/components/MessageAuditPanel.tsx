/**
 * MessageAuditPanel — log di audit visibile sotto il messaggio del Direttore.
 * Mostra: fase eseguita, riepilogo piano, step (tool driver) con reasoning,
 * riferimenti tracciabili (Prompt Lab, KB, model, playbook, contesto).
 *
 * Collassabile, compatto, design coerente con CommandThread.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ScrollText } from "lucide-react";
import type { MessageAudit } from "../constants";

interface Props {
  audit: MessageAudit;
}

const phaseLabel: Record<MessageAudit["phase"], string> = {
  "fast-lane": "Fast lane",
  "plan-execution": "Plan execution",
  "approval-step": "Approval step",
};

const refKindLabel: Record<NonNullable<MessageAudit["references"]>[number]["kind"], string> = {
  "operative-prompt": "Prompt Lab",
  "kb-section": "KB",
  "model": "Model",
  "playbook": "Playbook",
  "context": "Contesto",
  "table": "Tabella",
  "keyword": "Keyword",
};

export default function MessageAuditPanel({ audit }: Props) {
  const [open, setOpen] = useState(false);
  const stepCount = audit.steps.length;
  const refCount = audit.references?.length ?? 0;
  const totalSec = audit.totalMs ? `${(audit.totalMs / 1000).toFixed(2)}s` : null;

  return (
    <div className="mt-3 pt-3 border-t border-border/[0.16]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 text-left text-[10px] text-muted-foreground/100 hover:text-foreground/90 font-mono transition-colors"
      >
        <ScrollText className="w-3 h-3 text-primary/80 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="uppercase tracking-[0.18em]">Audit</span>
          <span className="text-foreground/60 normal-case tracking-normal font-light text-[10px] leading-snug">
            {phaseLabel[audit.phase]} · {stepCount} step{stepCount !== 1 ? "s" : ""} · driver: {audit.driver}
            {totalSec ? ` · ${totalSec}` : ""}
          </span>
        </div>
        <ChevronRight
          className={`mt-0.5 shrink-0 w-3 h-3 text-muted-foreground/80 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-3 text-[11px] font-light text-foreground/85">
              {audit.planSummary && (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/90 font-mono mb-1">
                    Piano
                  </div>
                  <div className="leading-relaxed">{audit.planSummary}</div>
                </div>
              )}

              {audit.steps.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/90 font-mono mb-1">
                    Step eseguiti
                  </div>
                  <ol className="space-y-1.5">
                    {audit.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary/80 font-mono text-[10px] mt-0.5">
                          {String(s.number).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] text-foreground/95">{s.label}</span>
                            <span className="text-[9px] text-muted-foreground/80 font-mono">
                              [{s.toolId}]
                            </span>
                            {s.durationMs !== undefined && s.durationMs > 0 && (
                              <span className="text-[9px] text-muted-foreground/80 font-mono">
                                · {(s.durationMs / 1000).toFixed(2)}s
                              </span>
                            )}
                            <span
                              className={`text-[9px] uppercase font-mono px-1.5 py-px rounded ${
                                s.status === "ok"
                                  ? "bg-success/10 text-success/90"
                                  : s.status === "failed"
                                  ? "bg-destructive/10 text-destructive/90"
                                  : "bg-muted/40 text-muted-foreground/90"
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>
                          {s.reasoning && (
                            <div className="text-[10px] text-muted-foreground/100 mt-0.5 leading-snug">
                              {s.reasoning}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {refCount > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/90 font-mono mb-1">
                    Riferimenti tracciabili
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {audit.references!.map((r, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-primary/20 bg-primary/5 text-[10px]"
                        title={r.value ?? ""}
                      >
                        <span className="text-primary/80 font-mono uppercase text-[8px] tracking-wider">
                          {refKindLabel[r.kind]}
                        </span>
                        <span className="text-foreground/90">{r.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
/**
 * PlanTimeline — Vertical step cards showing plan execution state.
 * States: pending, running, done, blocked-on-approval, error.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, ShieldAlert, AlertCircle, Clock } from "lucide-react";
import type { PlanStepState, PlanStepStatus } from "../planRunner";
import { TOOLS } from "../tools/registry";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface Props {
  stepStates: PlanStepState[];
  visible: boolean;
  onApproveStep?: (stepNumber: number) => void;
  onRejectStep?: (stepNumber: number) => void;
}

const statusConfig: Record<PlanStepStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-muted-foreground/60", label: "In attesa" },
  running: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: "text-primary", label: "In esecuzione" },
  done: { icon: <Check className="w-3.5 h-3.5" />, color: "text-success", label: "Completato" },
  "blocked-on-approval": { icon: <ShieldAlert className="w-3.5 h-3.5" />, color: "text-warning", label: "Approvazione richiesta" },
  error: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-destructive", label: "Errore" },
};

export default function PlanTimeline({ stepStates, visible, onApproveStep, onRejectStep }: Props) {
  if (!visible || stepStates.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.5, ease }}
      className="space-y-1 my-4"
    >
      <div className="text-[9px] text-muted-foreground/70 font-mono tracking-wider uppercase mb-2 px-1">
        Piano · {stepStates.length} step
      </div>
      {stepStates.map((ss, i) => {
        const cfg = statusConfig[ss.status];
        const toolLabel = TOOLS.find((t) => t.id === ss.step.toolId)?.label ?? ss.step.toolId;
        const isLast = i === stepStates.length - 1;

        return (
          <div key={ss.step.stepNumber} className="relative flex gap-3">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[13px] top-[28px] w-px h-[calc(100%-12px)]" style={{ background: ss.status === "done" ? "hsl(var(--success) / 0.3)" : "hsl(0 0% 100% / 0.08)" }} />
            )}

            {/* Status icon */}
            <motion.div
              className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}
              style={{
                background: ss.status === "done" ? "hsl(var(--success) / 0.12)"
                  : ss.status === "blocked-on-approval" ? "hsl(45 100% 50% / 0.12)"
                  : ss.status === "error" ? "hsl(var(--destructive) / 0.12)"
                  : ss.status === "running" ? "hsl(var(--primary) / 0.12)"
                  : "hsl(0 0% 100% / 0.04)",
              }}
              animate={ss.status === "running" ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {cfg.icon}
            </motion.div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={ss.status}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 pb-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/50 font-mono">{ss.step.stepNumber}</span>
                  <span className="text-[12px] font-light text-foreground/90">{toolLabel}</span>
                  {ss.requiresApproval && ss.status !== "done" && (
                    <span className="px-1.5 py-0.5 rounded text-[7px] font-mono tracking-wider bg-warning/10 text-warning/80 border border-warning/20">WRITE</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/70 font-light mt-0.5">{ss.step.reasoning}</p>

                {ss.status === "done" && ss.result && (
                  <div className="text-[10px] text-success/80 font-mono mt-1">
                    ✓ {ss.result.kind === "result" ? ss.result.message?.slice(0, 80) : `${ss.result.meta?.count ?? 0} risultati`}
                  </div>
                )}

                {ss.status === "error" && ss.error && (
                  <div className="text-[10px] text-destructive/80 font-mono mt-1">✗ {ss.error}</div>
                )}

                {ss.status === "blocked-on-approval" && (
                  <div className="flex items-center gap-2 mt-2">
                    <motion.button
                      onClick={() => onApproveStep?.(ss.step.stepNumber)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-success/15 text-success hover:bg-success/25 transition-all border border-success/20"
                    >
                      Approva
                    </motion.button>
                    <motion.button
                      onClick={() => onRejectStep?.(ss.step.stepNumber)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-all"
                    >
                      Annulla piano
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        );
      })}
    </motion.div>
  );
}

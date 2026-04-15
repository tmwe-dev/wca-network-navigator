import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";

const ease = [0.2, 0.8, 0.2, 1] as const;

export interface ExecutionStep {
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

interface ExecutionFlowProps {
  visible: boolean;
  steps: ExecutionStep[];
  progress?: number;
}

const ExecutionFlow = ({ visible, steps, progress }: ExecutionFlowProps) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.5, ease }}
        className="rounded-2xl p-5 mt-4"
        style={{
          background: "hsl(var(--card) / 0.75)",
          backdropFilter: "blur(40px)",
          border: "1px solid hsl(var(--foreground) / 0.1)",
        }}
      >
        {progress !== undefined && (
          <div className="mb-4">
            <div className="h-[2px] rounded-full bg-secondary/25 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.7), hsl(var(--accent) / 0.65))" }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease }}
              />
            </div>
            <div className="text-[9px] text-muted-foreground mt-1.5 text-right font-mono">{progress}%</div>
          </div>
        )}

        <div className="space-y-0.5">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease }}
              className="flex items-center gap-3 py-2 px-2 rounded-lg"
            >
              <div className="flex-shrink-0 w-4 flex justify-center">
                {step.status === "done" ? (
                  <CheckCircle2 className="w-3 h-3 text-success/80" />
                ) : step.status === "running" ? (
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                ) : step.status === "error" ? (
                  <div className="w-2 h-2 rounded-full bg-destructive/50" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                )}
              </div>
              <span className={`text-[11px] font-light flex-1 ${
                step.status === "done" ? "text-foreground" :
                step.status === "running" ? "text-foreground" :
                "text-muted-foreground"
              }`}>{step.label}</span>
              {step.detail && (
                <span className="text-[9px] text-muted-foreground font-mono">{step.detail}</span>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ExecutionFlow;

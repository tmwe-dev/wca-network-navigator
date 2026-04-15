import { useState, useEffect, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.2, 0.8, 0.2, 1] as const;

export interface ToolActivation {
  icon: ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  label: string;
  color: string;
}

export interface SourceTag {
  name: string;
  color: string;
}

interface ToolActivationBarProps {
  tools: ToolActivation[];
  sources?: SourceTag[];
  visible: boolean;
  phase?: "activating" | "active" | "done";
  chainSteps?: string[];
  chainHighlight?: number;
}

const defaultChainSteps = ["FONTE", "UNIFICA", "ANALISI", "TOOL", "APPROVAZIONE", "ESECUZIONE", "AUDIT"];

const ToolActivationBar = ({
  tools,
  sources = [],
  visible,
  phase = "active",
  chainSteps = defaultChainSteps,
  chainHighlight,
}: ToolActivationBarProps) => {
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (!visible || phase !== "activating") {
      setRevealedCount(tools.length);
      return;
    }
    setRevealedCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setRevealedCount(i);
      if (i >= tools.length) clearInterval(interval);
    }, 280);
    return () => clearInterval(interval);
  }, [visible, phase, tools.length]);

  return (
    <AnimatePresence>
      {visible && tools.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease }}
          className="overflow-hidden"
        >
          {/* Operational chain strip */}
          <div className="flex items-center gap-1 py-1.5 px-1 mb-1">
            {chainSteps.map((step, i) => {
              const isActive = chainHighlight !== undefined && i <= chainHighlight;
              const isCurrent = chainHighlight !== undefined && i === chainHighlight;
              return (
                <div key={step} className="flex items-center gap-1">
                  <motion.span
                    className={`text-[7px] tracking-[0.15em] font-mono transition-all duration-500 ${
                      isCurrent ? "text-primary" : isActive ? "text-muted-foreground" : "text-muted-foreground/50"
                    }`}
                    animate={isCurrent ? { opacity: [0.7, 1, 0.7] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {step}
                  </motion.span>
                  {i < chainSteps.length - 1 && (
                    <span className={`text-[8px] ${isActive ? "text-muted-foreground" : "text-muted-foreground/30"}`}>→</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tools */}
          <div className="flex items-center gap-1 py-2 px-1 flex-wrap">
            <span className="text-[8px] text-muted-foreground tracking-[0.2em] uppercase mr-2 font-mono">TOOLS</span>
            {tools.map((tool, i) => {
              const revealed = i < revealedCount;
              const Icon = tool.icon;
              return (
                <motion.div
                  key={`${tool.label}-${i}`}
                  initial={{ opacity: 0, scale: 0.8, x: -8 }}
                  animate={{ opacity: revealed ? 1 : 0.25, scale: revealed ? 1 : 0.9, x: 0 }}
                  transition={{ delay: phase === "activating" ? 0 : i * 0.06, duration: 0.3, ease }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg relative"
                  style={{
                    background: `hsl(${tool.color} / ${revealed ? 0.16 : 0.08})`,
                    border: `1px solid hsl(${tool.color} / ${revealed ? 0.24 : 0.14})`,
                  }}
                >
                  {revealed && phase === "activating" && i === revealedCount - 1 && (
                    <motion.div
                      className="absolute inset-0 rounded-lg"
                      initial={{ boxShadow: `0 0 12px hsl(${tool.color} / 0.7)` }}
                      animate={{ boxShadow: `0 0 0px hsl(${tool.color} / 0)` }}
                      transition={{ duration: 0.8 }}
                    />
                  )}
                  <Icon className="w-2.5 h-2.5" style={{ color: `hsl(${tool.color} / ${revealed ? 0.55 : 0.2})` }} strokeWidth={1.5} />
                  <span className="text-[8px] font-light" style={{ color: `hsl(${tool.color} / ${revealed ? 0.6 : 0.2})` }}>{tool.label}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Sources */}
          {sources.length > 0 && (
            <div className="flex items-center gap-1 py-1 px-1 flex-wrap">
              <span className="text-[8px] text-muted-foreground tracking-[0.2em] uppercase mr-2 font-mono">FONTI</span>
              {sources.map((src, i) => (
                <motion.span
                  key={src.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="text-[8px] px-2 py-1 rounded-lg font-mono"
                  style={{ color: `hsl(${src.color})`, background: `hsl(${src.color} / 0.34)`, border: `1px solid hsl(${src.color} / 0.34)` }}
                >
                  {src.name}
                </motion.span>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ToolActivationBar;

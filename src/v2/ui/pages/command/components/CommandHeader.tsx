/**
 * CommandHeader — back button + session indicator + agent dots + lang toggle.
 */
import { motion } from "framer-motion";
import { ArrowLeft, Globe2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { FlowPhase } from "../constants";
import { agentDots } from "../constants";

interface Props {
  flowPhase: FlowPhase;
  lang: "it" | "en";
  onToggleLang: () => void;
}

export default function CommandHeader({ flowPhase, lang, onToggleLang }: Props) {
  const nav = useNavigate();

  return (
    <>
      {/* Fixed back button */}
      <motion.button
        onClick={() => nav("/v2")}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-all backdrop-blur-md border border-white/[0.06]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Dashboard</span>
      </motion.button>

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(210 100% 66% / 0.012), transparent 70%)" }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 relative z-10 flex-shrink-0">
        <div className="flex items-center gap-3 ml-28">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-primary/95" animate={{ opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 3, repeat: Infinity }} />
          <span className="text-[11px] text-muted-foreground/98 font-light tracking-wide">Sessione attiva</span>
          {flowPhase !== "idle" && flowPhase !== "done" && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-primary/92 font-mono ml-2">
              {flowPhase === "thinking" ? "ELABORAZIONE" : flowPhase === "proposal" ? "PROPOSTA" : flowPhase === "approval" ? "IN ATTESA" : "ESECUZIONE"}
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            {agentDots.map((a) => (
              <motion.div
                key={a.agent}
                className={`w-1.5 h-1.5 rounded-full ${a.status === "done" ? "bg-success/90" : a.status === "running" ? "bg-primary/95" : "bg-muted-foreground/20"}`}
                animate={a.status === "running" ? { opacity: [0.55, 0.9, 0.55] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                title={a.agent}
              />
            ))}
          </div>
          <span className="text-[8px] text-muted-foreground/100 font-mono tracking-wider">14 fonti · 12.8k contatti · 234 partner · 7 agenti</span>
          <motion.button
            onClick={onToggleLang}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(270_60%_60%)]/10 border border-[hsl(270_60%_60%)]/20 text-[hsl(270_60%_70%)] hover:bg-[hsl(270_60%_60%)]/15 transition-all duration-300"
            title="Cambia lingua"
          >
            <Globe2 className="w-3 h-3" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">{lang === "it" ? "IT" : "EN"}</span>
          </motion.button>
        </div>
      </div>
    </>
  );
}

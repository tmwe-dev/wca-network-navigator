import { motion } from "framer-motion";
import { Activity, Globe2, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface AgentDot {
  agent: string;
  status: "done" | "running" | "monitoring";
}

const AGENT_DOTS: AgentDot[] = [
  { agent: "Orchestratore", status: "done" },
  { agent: "CRM Core", status: "done" },
  { agent: "Partner Scout", status: "done" },
  { agent: "Outreach Runner", status: "running" },
  { agent: "Follow-up Watcher", status: "monitoring" },
  { agent: "Automation", status: "done" },
  { agent: "Governance", status: "monitoring" },
];

interface CommandPageHeaderProps {
  flowPhase: string;
  lang: string;
  onLangChange: () => void;
  onOpenTraceConsole: () => void;
}

export function CommandPageHeader({ flowPhase, lang, onLangChange, onOpenTraceConsole }: CommandPageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 relative z-10 flex-shrink-0">
      <div className="flex items-center gap-3 ml-28">
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-primary/95"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <span className="text-[11px] text-muted-foreground/98 font-light tracking-wide">
          Sessione attiva
        </span>
        {flowPhase !== "idle" && flowPhase !== "done" && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[9px] text-primary/92 font-mono ml-2"
          >
            {flowPhase === "thinking"
              ? "ELABORAZIONE"
              : flowPhase === "proposal"
                ? "PROPOSTA"
                : flowPhase === "approval"
                  ? "IN ATTESA"
                  : "ESECUZIONE"}
          </motion.span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          {AGENT_DOTS.map((a) => (
            <motion.div
              key={a.agent}
              className={`w-1.5 h-1.5 rounded-full ${
                a.status === "done"
                  ? "bg-success/90"
                  : a.status === "running"
                    ? "bg-primary/95"
                    : "bg-muted-foreground/20"
              }`}
              animate={
                a.status === "running"
                  ? { opacity: [0.55, 0.9, 0.55] }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity }}
              title={a.agent}
            />
          ))}
        </div>
        <span className="text-[8px] text-muted-foreground/100 font-mono tracking-wider">
          14 fonti · 12.8k contatti · 234 partner · 7 agenti
        </span>
        <button
          type="button"
          onClick={onOpenTraceConsole}
          className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/60 border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-300"
          title="Apri monitor AI"
          aria-label="Apri monitor AI"
        >
          <Activity className="w-3 h-3" />
          <span className="text-[9px] font-semibold tracking-wider uppercase">Monitor</span>
        </button>
        <Link
          to="/v2/command/help"
          className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/60 border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-300"
          title="Cosa può fare Command"
          aria-label="Cosa può fare Command"
        >
          <HelpCircle className="w-3 h-3" />
          <span className="text-[9px] font-semibold tracking-wider uppercase">Cosa posso fare</span>
        </Link>
        <motion.button
          onClick={onLangChange}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(270_60%_60%)]/10 border border-[hsl(270_60%_60%)]/20 text-[hsl(270_60%_70%)] hover:bg-[hsl(270_60%_60%)]/15 transition-all duration-300"
          title="Cambia lingua"
        >
          <Globe2 className="w-3 h-3" />
          <span className="text-[9px] font-semibold tracking-wider uppercase">
            {lang === "it" ? "IT" : "EN"}
          </span>
        </motion.button>
      </div>
    </div>
  );
}

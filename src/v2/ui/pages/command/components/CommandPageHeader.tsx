import { motion } from "framer-motion";
import { Activity, Globe2, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import RealtimeVoiceToggle from "./RealtimeVoiceToggle";

interface CommandPageHeaderProps {
  flowPhase: string;
  lang: string;
  onLangChange: () => void;
  onOpenTraceConsole: () => void;
}

export function CommandPageHeader({ flowPhase, lang, onLangChange, onOpenTraceConsole }: CommandPageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 relative z-10 flex-shrink-0">
      <div className="flex items-center gap-2 ml-28 min-w-0">
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-primary/95 shrink-0"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <span className="text-[11px] text-muted-foreground/98 font-light tracking-wide whitespace-nowrap">
          Command
        </span>
        {flowPhase !== "idle" && flowPhase !== "done" && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[9px] text-primary/92 font-mono ml-1 whitespace-nowrap"
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

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenTraceConsole}
          className="flex items-center justify-center w-7 h-7 rounded-md bg-accent/40 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Apri monitor AI"
          aria-label="Apri monitor AI"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>
        <Link
          to="/v2/command/help"
          className="flex items-center justify-center w-7 h-7 rounded-md bg-accent/40 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Cosa può fare Command"
          aria-label="Cosa può fare Command"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </Link>
        <RealtimeVoiceToggle />
        <motion.button
          onClick={onLangChange}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1 px-2 h-7 rounded-md bg-[hsl(270_60%_60%)]/10 border border-[hsl(270_60%_60%)]/20 text-[hsl(270_60%_70%)] hover:bg-[hsl(270_60%_60%)]/15 transition-colors"
          title="Cambia lingua"
        >
          <Globe2 className="w-3 h-3" />
          <span className="text-[10px] font-semibold tracking-wider uppercase">
            {lang === "it" ? "IT" : "EN"}
          </span>
        </motion.button>
      </div>
    </div>
  );
}

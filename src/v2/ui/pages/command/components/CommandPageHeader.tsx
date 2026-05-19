import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Globe2, HelpCircle, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import RealtimeVoiceToggle from "./RealtimeVoiceToggle";

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
  const [open, setOpen] = useState(false);
  const phaseLabel =
    flowPhase === "thinking" ? "ELABORAZIONE" :
    flowPhase === "proposal" ? "PROPOSTA" :
    flowPhase === "approval" ? "IN ATTESA" :
    flowPhase !== "idle" && flowPhase !== "done" ? "ESECUZIONE" : null;

  return (
    // Lean Mode 2026-05-19: barra essenziale, sinistra-allineata.
    // Tutta la telemetria (sessione, agent dots, fonti, monitor, help, voce, lingua)
    // è dietro l'icona "Dettagli" (Info). Si apre solo on-click.
    <div className="flex items-center justify-start gap-2 px-4 py-2 relative z-10 flex-shrink-0">
      <motion.div
        className="w-1.5 h-1.5 rounded-full bg-primary/95 ml-14"
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
        title="Sessione attiva"
        aria-label="Sessione attiva"
      />
      {phaseLabel && (
        <span className="text-[9px] text-primary/90 font-mono uppercase tracking-wider">
          {phaseLabel}
        </span>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Dettagli sessione"
            title="Dettagli"
            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="w-72 p-3 bg-background/95 backdrop-blur-xl border-white/10 space-y-3"
        >
          {/* Stato agenti */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Agenti
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {AGENT_DOTS.map((a) => (
                <div key={a.agent} className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      a.status === "done"
                        ? "bg-success/90"
                        : a.status === "running"
                        ? "bg-primary/95"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <span className="text-[10px] text-foreground/80">{a.agent}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="text-[10px] text-muted-foreground font-mono">
            14 fonti · 12.8k contatti · 234 partner · 7 agenti
          </div>

          <div className="border-t border-white/10" />

          {/* Azioni */}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => { setOpen(false); onOpenTraceConsole(); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground/85 hover:bg-primary/10 hover:text-primary text-left"
            >
              <Activity className="w-3.5 h-3.5" />
              Monitor AI
            </button>
            <Link
              to="/v2/command/help"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground/85 hover:bg-primary/10 hover:text-primary"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Cosa posso fare
            </Link>
            <button
              type="button"
              onClick={() => { setOpen(false); onLangChange(); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground/85 hover:bg-primary/10 hover:text-primary text-left"
            >
              <Globe2 className="w-3.5 h-3.5" />
              Lingua: {lang === "it" ? "IT" : "EN"}
            </button>
            <div className="px-2 py-1">
              <RealtimeVoiceToggle />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

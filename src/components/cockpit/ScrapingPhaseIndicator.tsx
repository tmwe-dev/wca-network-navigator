import { motion } from "framer-motion";
import { Sparkles, Search, Globe, Brain, User, CheckCircle2, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScrapingPhase, DraftState } from "@/pages/Cockpit";

const scrapingPhaseConfig: Record<ScrapingPhase, { icon: React.ElementType; label: string; color: string }> = {
  idle: { icon: Sparkles, label: "", color: "text-muted-foreground" },
  searching: { icon: Search, label: "🔍 Ricerca profilo LinkedIn...", color: "text-chart-3" },
  visiting: { icon: Globe, label: "Visita profilo LinkedIn...", color: "text-[hsl(210,80%,55%)]" },
  extracting: { icon: Search, label: "Estrazione dati profilo...", color: "text-[hsl(210,80%,55%)]" },
  enriching: { icon: Brain, label: "Analisi contesto e arricchimento...", color: "text-chart-3" },
  reviewing: { icon: User, label: "📋 Dati pronti — Rivedi prima di generare", color: "text-success" },
  generating: { icon: Sparkles, label: "Generazione messaggio AI...", color: "text-primary" },
};

export { scrapingPhaseConfig };

export function ScrapingPhaseIndicator({ phase, linkedinProfile }: { phase: ScrapingPhase; linkedinProfile: DraftState["linkedinProfile"] }) {
  const config = scrapingPhaseConfig[phase] || scrapingPhaseConfig.generating;
  const PhaseIcon = config.icon;
  const phases: ScrapingPhase[] = ["searching", "visiting", "extracting", "enriching", "generating"];
  const currentIndex = phases.indexOf(phase);
  const showSteps = phase !== "idle" && phase !== "generating" || (phase === "generating" && linkedinProfile);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
          <PhaseIcon className={cn("w-4 h-4", config.color)} />
        </motion.div>
        <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
      </div>
      {showSteps && (
        <div className="space-y-1.5">
          {phases.map((p, i) => {
            const stepConfig = scrapingPhaseConfig[p];
            const StepIcon = stepConfig.icon;
            const isDone = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <motion.div key={p} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
                className={cn("flex items-center gap-2 text-[11px] px-2 py-1 rounded", isDone ? "text-success bg-success/5" : isCurrent ? `${stepConfig.color} bg-muted/40` : "text-muted-foreground/40")}>
                {isDone ? <CheckCircle2 className="w-3 h-3" /> : <StepIcon className="w-3 h-3" />}
                <span>{stepConfig.label}</span>
              </motion.div>
            );
          })}
        </div>
      )}
      {linkedinProfile && (phase === "enriching" || phase === "generating") && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-[hsl(210,80%,55%)]/5 border border-[hsl(210,80%,55%)]/20 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(210,80%,55%)] uppercase tracking-wider">
            <Linkedin className="w-3 h-3" /> Profilo estratto
          </div>
          {linkedinProfile.name && <div className="text-xs font-medium text-foreground">{linkedinProfile.name}</div>}
          {linkedinProfile.headline && <div className="text-[11px] text-muted-foreground">{linkedinProfile.headline}</div>}
          {linkedinProfile.about && <div className="text-[10px] text-muted-foreground/80 line-clamp-2">{linkedinProfile.about}</div>}
          {linkedinProfile.location && <div className="text-[10px] text-muted-foreground/60">📍 {linkedinProfile.location}</div>}
        </motion.div>
      )}
    </div>
  );
}

/**
 * MissionStepRenderer — Orchestrator (refactored from 702-line monolith)
 * Re-exports types for backward compatibility.
 */
import { motion } from "framer-motion";
import {
  Globe, Hash, Radio, Search, MessageSquareText, Paperclip, Palette,
  Users, Clock, FileCheck, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStepComponent } from "./steps/stepRegistry";

// Re-export types so existing imports keep working
export type {
  MissionStepData, DeepSearchConfig, CommunicationConfig,
  AttachmentConfig, ToneConfig, CountryStat, AgentInfo,
} from "./steps/types";

export const STEP_CONFIG = [
  { title: "Chi contattare?", icon: Globe, desc: "Seleziona paesi e filtri target" },
  { title: "Quanti e come frazionare?", icon: Hash, desc: "Distribuisci i contatti in batch" },
  { title: "Con quale canale?", icon: Radio, desc: "Email, WhatsApp, LinkedIn o mix" },
  { title: "Deep Search?", icon: Search, desc: "Arricchimento dati prima dell'invio" },
  { title: "Tipo di comunicazione", icon: MessageSquareText, desc: "Genera o scegli un modello di messaggio" },
  { title: "Allegati, immagini e link", icon: Paperclip, desc: "Documenti, immagini e riferimenti" },
  { title: "Tono e qualità", icon: Palette, desc: "Livello qualità, tono e lingua" },
  { title: "Assegnare agenti?", icon: Users, desc: "Distribuisci il lavoro tra gli agenti AI" },
  { title: "Quando inviare?", icon: Clock, desc: "Subito, programmato o distribuito" },
  { title: "Conferma e crea", icon: FileCheck, desc: "Rivedi e lancia la missione" },
];

export const TOTAL_STEPS = STEP_CONFIG.length;

interface StepProps {
  stepIndex: number;
  data: import("./steps/types").MissionStepData;
  onChange: (d: import("./steps/types").MissionStepData) => void;
  onComplete: () => void;
  stats?: { countries: import("./steps/types").CountryStat[] };
  agentsList?: import("./steps/types").AgentInfo[];
}

export function MissionStepRenderer({ stepIndex, data, onChange, onComplete, stats, agentsList }: StepProps) {
  const cfg = STEP_CONFIG[stepIndex];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const StepComponent = getStepComponent(stepIndex);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-card border border-border rounded-xl p-6 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{cfg.title}</h3>
          <p className="text-xs text-muted-foreground">{cfg.desc}</p>
        </div>
        <Badge variant="outline" className="ml-auto">Step {stepIndex + 1}/{TOTAL_STEPS}</Badge>
      </div>

      <div className="min-h-[120px]">
        {StepComponent && <StepComponent data={data} onChange={onChange} stats={stats} agentsList={agentsList} />}
      </div>

      <div className="flex justify-end">
        <Button onClick={onComplete} className="gap-2">
          {stepIndex === TOTAL_STEPS - 1 ? "🚀 Lancia Missione" : "Avanti"} <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

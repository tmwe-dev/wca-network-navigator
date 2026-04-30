/**
 * MessagePipelineTracker — Animated horizontal badges that show every stage
 * a message goes through (Contract → Detector → Oracle → Decision → Prompt
 * → AI → Journalist → Ready). Visual style mirrors the Command tool badges.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck2,
  ScanSearch,
  Sparkles,
  Brain,
  BookOpen,
  Bot,
  Newspaper,
  CheckCheck,
  Loader2,
  AlertTriangle,
  XCircle,
  Circle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PipelineSnapshot,
  type PipelineStage,
  type PipelineStageId,
  type PipelineStageStatus,
} from "@/lib/messaging/pipelineBus";
import { useMessagePipeline } from "@/hooks/useMessagePipeline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  pipelineId?: string | null;
  snapshot?: PipelineSnapshot | null;
  compact?: boolean;
  className?: string;
}

const STAGE_META: Record<
  PipelineStageId,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  contract: { label: "Contract", icon: FileCheck2, description: "Validazione contratto e regole email" },
  detector: { label: "Detector", icon: ScanSearch, description: "Tipo messaggio e history del lead" },
  oracle: { label: "Oracle", icon: Sparkles, description: "Contesto: partner, KB, memoria, BCA" },
  decision: { label: "Decision", icon: Brain, description: "Strategia commerciale e tone" },
  prompt: { label: "Prompt Lab", icon: BookOpen, description: "Composizione system prompt operativo" },
  ai: { label: "AI", icon: Bot, description: "Generazione modello LLM" },
  journalist: { label: "Journalist", icon: Newspaper, description: "Revisione editoriale finale" },
  ready: { label: "Ready", icon: CheckCheck, description: "Bozza pronta" },
};

function StatusIcon({ status }: { status: PipelineStageStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-3 h-3 animate-spin" />;
    case "done":
      return <CheckCheck className="w-3 h-3" />;
    case "warn":
      return <AlertTriangle className="w-3 h-3" />;
    case "error":
      return <XCircle className="w-3 h-3" />;
    default:
      return <Circle className="w-3 h-3 opacity-40" />;
  }
}

function StageBadge({ stage, compact }: { stage: PipelineStage; compact?: boolean }) {
  const meta = STAGE_META[stage.id] ?? {
    label: stage.id,
    icon: Circle,
    description: "",
  };
  const Icon = meta.icon;

  const colorClass =
    stage.status === "done"
      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
      : stage.status === "running"
        ? "bg-primary/15 text-primary border-primary/40 animate-pulse"
        : stage.status === "warn"
          ? "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400"
          : stage.status === "error"
            ? "bg-destructive/15 text-destructive border-destructive/40"
            : "bg-muted/40 text-muted-foreground border-border/40";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
              colorClass,
            )}
          >
            <Icon className="w-3 h-3" />
            {!compact && <span>{meta.label}</span>}
            <StatusIcon status={stage.status} />
            {!compact && stage.durationMs != null && stage.status === "done" && (
              <span className="text-[10px] opacity-60 tabular-nums">{Math.round(stage.durationMs)}ms</span>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          <div className="font-semibold">{meta.label}</div>
          <div className="text-muted-foreground">{meta.description}</div>
          {stage.detail && <div className="mt-1 text-foreground/80">{stage.detail}</div>}
          {stage.durationMs != null && (
            <div className="mt-1 text-muted-foreground tabular-nums">{Math.round(stage.durationMs)}ms</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function MessagePipelineTracker({ pipelineId, snapshot: snapProp, compact, className }: Props) {
  const live = useMessagePipeline(pipelineId ?? null);
  const snap = snapProp ?? live;

  // Keep mounted briefly after end so the user actually sees "Ready ✓"
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (snap) {
      setVisible(true);
      if (snap.endedAt) {
        const t = setTimeout(() => setVisible(false), 6000);
        return () => clearTimeout(t);
      }
    }
  }, [snap?.pipelineId, snap?.endedAt]);

  if (!snap || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={snap.pipelineId}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/70 backdrop-blur px-2.5 py-2",
          className,
        )}
        aria-label="Stato generazione messaggio"
      >
        {snap.label && !compact && (
          <span className="text-[11px] text-muted-foreground mr-1 truncate max-w-[180px]">{snap.label}</span>
        )}
        {snap.stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-1.5">
            <StageBadge stage={stage} compact={compact} />
            {i < snap.stages.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
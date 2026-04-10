import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle2, X, AlertTriangle, Zap, Clock, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MissionPlan } from "@/hooks/useMissionActions";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface MissionPlanReviewProps {
  plan: MissionPlan;
  visible: boolean;
  isApproving: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

const dangerConfig = {
  safe: { color: "text-success", bg: "bg-success/10", border: "border-success/20", icon: Shield, label: "Sicuro" },
  moderate: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle, label: "Moderato" },
  critical: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", icon: AlertTriangle, label: "Critico" },
};

export default function MissionPlanReview({ plan, visible, isApproving, onApprove, onCancel }: MissionPlanReviewProps) {
  const cfg = dangerConfig[plan.dangerLevel] || dangerConfig.safe;
  const DangerIcon = cfg.icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.5, ease }}
          className="mt-3 rounded-xl border p-4 space-y-3"
          style={{
            background: "hsl(var(--background) / 0.85)",
            backdropFilter: "blur(30px)",
            borderColor: "hsl(var(--border) / 0.3)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Piano Missione</span>
            <Badge className={`ml-auto text-[10px] ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
              <DangerIcon className="w-3 h-3 mr-1" />
              {cfg.label}
            </Badge>
          </div>

          {/* Interpretation */}
          <p className="text-xs text-muted-foreground leading-relaxed">{plan.interpretation}</p>

          {/* Actions list */}
          <div className="space-y-1.5">
            {plan.actions.map((action, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05, ease }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/20"
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{action.label}</p>
                  {action.details && (
                    <p className="text-[10px] text-muted-foreground truncate">{action.details}</p>
                  )}
                </div>
                <Zap className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {plan.actions.length} azioni
            </span>
            <span>•</span>
            <span>{plan.totalContacts} contatti</span>
            <span>•</span>
            <span className="font-mono text-[10px] text-muted-foreground/50">{plan.idempotencyKey.slice(0, 20)}…</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={onApprove}
              disabled={isApproving}
              className="gap-1.5 flex-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isApproving ? "Approvazione..." : "Approva ed Esegui"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={isApproving}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

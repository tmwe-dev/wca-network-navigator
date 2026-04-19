/**
 * LiveActivityRail — small fixed strip rendered inside the canvas area.
 * Shows the most recent realtime events from useCommandRealtime.
 * Same float-panel aesthetic, mono fonts, gradient accent.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Globe, Target, Megaphone, Activity } from "lucide-react";
import type { LiveActivity } from "../hooks/useCommandRealtime";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface Props {
  activities: LiveActivity[];
}

const KIND_META: Record<LiveActivity["kind"], { icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  outreach: { icon: Send, tint: "text-primary/80" },
  scrape: { icon: Globe, tint: "text-warning/80" },
  agent: { icon: Bot, tint: "text-success/80" },
  mission: { icon: Target, tint: "text-primary/80" },
  campaign: { icon: Megaphone, tint: "text-warning/80" },
};

const STATUS_DOT: Record<LiveActivity["status"], string> = {
  running: "bg-primary/80 animate-pulse",
  success: "bg-success/80",
  warning: "bg-warning/80",
  error: "bg-destructive/80",
};

export default function LiveActivityRail({ activities }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="float-panel-subtle rounded-xl p-3 mt-4"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Activity className="w-3 h-3 text-primary/70" />
        <span className="text-[9px] font-mono tracking-wider uppercase text-muted-foreground/70">Live activity</span>
        {activities.length > 0 && (
          <span className="text-[9px] font-mono text-gradient-primary ml-auto">{activities.length}</span>
        )}
      </div>
      {activities.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/50 font-light italic py-2">In ascolto di eventi…</p>
      ) : (
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
          <AnimatePresence initial={false}>
            {activities.map((a) => {
              const Meta = KIND_META[a.kind];
              const Icon = Meta.icon;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -6, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.3, ease }}
                  className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-primary/[0.04] transition-colors"
                >
                  <Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${Meta.tint}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-light text-foreground/90 truncate">{a.label}</div>
                    {a.detail && (
                      <div className="text-[8px] text-muted-foreground/60 font-mono truncate">{a.detail}</div>
                    )}
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${STATUS_DOT[a.status]}`} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

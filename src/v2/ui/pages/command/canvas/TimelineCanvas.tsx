import { motion } from "framer-motion";
import { CheckCircle2, Clock, AlertTriangle, Zap } from "lucide-react";

const ease = [0.2, 0.8, 0.2, 1] as const;

export interface TimelineEvent {
  time: string;
  agent: string;
  action: string;
  status: "success" | "pending" | "warning" | "info";
}

export interface TimelineKpi {
  label: string;
  value: string;
}

interface TimelineCanvasProps {
  events: TimelineEvent[];
  kpis?: TimelineKpi[];
}

const statusIcon = {
  success: <CheckCircle2 className="w-3 h-3 text-success/70" />,
  pending: <Clock className="w-3 h-3 text-warning/70" />,
  warning: <AlertTriangle className="w-3 h-3 text-destructive/60" />,
  info: <Zap className="w-3 h-3 text-primary/70" />,
};

const statusDot = {
  success: "bg-success/50",
  pending: "bg-warning/50",
  warning: "bg-destructive/50",
  info: "bg-primary/50",
};

const TimelineCanvas = ({ events, kpis }: TimelineCanvasProps) => (
  <div className="space-y-5">
    {/* KPIs header */}
    {kpis && kpis.length > 0 && (
      <div className="grid grid-cols-3 gap-2">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease }}
            className="float-panel-subtle p-3 rounded-xl text-center"
          >
            <div className="text-lg font-extralight tracking-tight text-gradient-primary">{kpi.value}</div>
            <div className="text-[8px] text-muted-foreground mt-1 tracking-wider uppercase font-mono">{kpi.label}</div>
          </motion.div>
        ))}
      </div>
    )}

    {/* Timeline */}
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/20" />

      <div className="space-y-0.5">
        {events.map((event, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.06, duration: 0.4, ease }}
            className="relative flex items-start gap-3 py-2.5"
          >
            {/* Dot on the line */}
            <div className={`absolute -left-6 top-3.5 w-2 h-2 rounded-full ${statusDot[event.status]} ring-2 ring-background`} />

            <div className="flex-shrink-0 mt-0.5">{statusIcon[event.status]}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-light text-foreground">{event.action}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-muted-foreground font-mono">{event.time}</span>
                <span className="text-[6px] text-muted-foreground">·</span>
                <span className="text-[9px] text-primary/60 font-mono">{event.agent}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default TimelineCanvas;

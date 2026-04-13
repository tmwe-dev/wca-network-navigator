/**
 * OutreachStatusTimeline — visual progression for outreach items
 */
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface TimelineStep {
  label: string;
  status: "done" | "active" | "pending" | "failed";
  date?: string;
  detail?: string;
}

interface Props {
  steps: TimelineStep[];
}

const statusConfig = {
  done: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500", line: "bg-emerald-500" },
  active: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500", line: "bg-blue-500/30" },
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", line: "bg-border" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive", line: "bg-destructive/30" },
};

export function OutreachStatusTimeline({ steps }: Props) {
  return (
    <div className="flex items-center gap-0 py-2">
      {steps.map((step, i) => {
        const cfg = statusConfig[step.status];
        const Icon = cfg.icon;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", cfg.bg, step.status === "pending" && "border border-border")}>
                <Icon className={cn("w-3 h-3", step.status === "pending" ? "text-muted-foreground" : "text-white")} />
              </div>
              <span className={cn("text-[9px] whitespace-nowrap", cfg.color)}>{step.label}</span>
              {step.date && (
                <span className="text-[8px] text-muted-foreground">
                  {format(new Date(step.date), "dd/MM HH:mm", { locale: it })}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("w-6 h-0.5 mx-0.5 mt-[-12px]", cfg.line)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

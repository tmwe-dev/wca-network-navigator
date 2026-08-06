/**
 * SequenceVisualizer — Horizontal dot-line timeline for a cadence sequence
 */
import { Mail, MessageCircle, Linkedin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TimingStep } from "@/data/outreachTimingTemplates";

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail, whatsapp: MessageCircle, linkedin: Linkedin, phone: Phone,
};
const CHANNEL_COLOR: Record<string, string> = {
  email: "bg-primary/20 text-primary border-primary/30",
  whatsapp: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  linkedin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  phone: "bg-amber-500/20 text-amber-500 border-amber-500/30",
};

interface Props {
  steps: TimingStep[];
  compact?: boolean;
}

export function SequenceVisualizer({ steps, compact }: Props) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const Icon = CHANNEL_ICON[step.channel] || Mail;
        const color = CHANNEL_COLOR[step.channel] || CHANNEL_COLOR.email;

        return (
          <div key={step.step} className="flex items-center">
            {i > 0 && (
              <div className="flex flex-col items-center mx-0.5">
                <div className="w-4 h-px bg-border/60" />
                {!compact && (
                  <span className="text-[7px] text-muted-foreground leading-none mt-0.5">+{step.delay_days}g</span>
                )}
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "rounded-full border flex items-center justify-center shrink-0",
                  compact ? "w-5 h-5" : "w-7 h-7",
                  color
                )}>
                  <Icon className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px]">
                <p className="font-medium">Step {step.step}: {step.channel}</p>
                <p className="text-muted-foreground">{step.template_hint}</p>
                <p className="text-[10px] text-muted-foreground">+{step.delay_days} giorni · {step.trigger}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

/**
 * OptimusBadge — indicatore inline dello stato dell'agente Optimus
 * per un combo (channel, pageType).
 *
 * 🟢 OK   → ultimo piano funzionante con confidence > 80%
 * 🟡 DOM cambiato → consecutive_failures > 0 o confidence ≤ 80%
 * 🔴 errore → consecutive_failures ≥ 3
 * ⚪ N/A   → mai invocato (nessuna riga in memory)
 */
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOptimusStatus, type OptimusChannel, type OptimusPageType } from "@/hooks/useOptimusStatus";

interface OptimusBadgeProps {
  channel: OptimusChannel;
  pageType: OptimusPageType;
  className?: string;
}

export function OptimusBadge({ channel, pageType, className }: OptimusBadgeProps) {
  const { data, isLoading } = useOptimusStatus(channel, pageType);

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("text-[9px] gap-1 h-5 px-1.5 cursor-default opacity-50", className)}>
        <Bot className="w-2.5 h-2.5" /> Optimus…
      </Badge>
    );
  }

  if (!data) {
    return (
      <Badge variant="outline" className={cn("text-[9px] gap-1 h-5 px-1.5 cursor-default text-muted-foreground", className)}>
        <Bot className="w-2.5 h-2.5" /> Optimus N/A
      </Badge>
    );
  }

  const failures = data.consecutive_failures;
  const conf = data.confidence;

  let label: string;
  let style: string;
  let title: string;

  if (failures >= 3) {
    label = "Optimus errore";
    style = "border-red-500 text-red-600 bg-red-500/10";
    title = `${failures} fallimenti consecutivi · piano v${data.plan_version}`;
  } else if (failures > 0 || conf <= 0.8) {
    label = "Optimus DOM";
    style = "border-yellow-500 text-yellow-600 bg-yellow-500/10";
    title = `Confidence ${(conf * 100).toFixed(0)}% · ${failures} fallimenti recenti · piano v${data.plan_version}`;
  } else {
    label = "Optimus OK";
    style = "border-green-500 text-green-600 bg-green-500/10";
    title = `Confidence ${(conf * 100).toFixed(0)}% · ${data.total_invocations} invocazioni · piano v${data.plan_version}`;
  }

  return (
    <Badge variant="outline" className={cn("text-[9px] gap-1 h-5 px-1.5 cursor-default", style, className)} title={title}>
      <Bot className="w-2.5 h-2.5" /> {label}
    </Badge>
  );
}

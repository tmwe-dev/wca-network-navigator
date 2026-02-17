import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "./theme";
import { useWcaSession } from "@/hooks/useWcaSession";

export function WcaSessionIndicator() {
  const isDark = useTheme();
  const { isSessionActive } = useWcaSession();

  const isOk = isSessionActive === true;
  const label = isOk ? "WCA Connesso" : isSessionActive === false ? "WCA Non connesso" : "WCA Stato sconosciuto";

  const dotColor = isOk
    ? (isDark ? "bg-emerald-400" : "bg-emerald-500")
    : (isDark ? "bg-red-400" : "bg-red-500");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${
            isDark
              ? "bg-white/[0.04] border-white/[0.1] text-slate-300"
              : "bg-white/60 border-slate-200 text-slate-600"
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <span className="hidden sm:inline">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isOk ? "Sessione WCA attiva" : "Sessione WCA non attiva"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

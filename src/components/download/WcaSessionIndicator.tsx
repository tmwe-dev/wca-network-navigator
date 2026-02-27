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
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
            isDark
              ? "text-slate-500"
              : "text-slate-400"
          }`}>
            <div className={`w-2 h-2 rounded-full ${dotColor}`} />
            <span className="text-[10px]">{isOk ? "WCA" : "WCA ✕"}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isOk ? "Sessione WCA attiva" : "Sessione WCA non attiva — configura nelle Impostazioni"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

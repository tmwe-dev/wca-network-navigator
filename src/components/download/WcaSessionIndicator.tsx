import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "./theme";
import { useWcaSession } from "@/hooks/useWcaSession";
import { Loader2 } from "lucide-react";

export function WcaSessionIndicator() {
  const isDark = useTheme();
  const { extensionAvailable, sessionActive, isChecking, lastError, ensureSession } = useWcaSession();

  const isOk = sessionActive === true;
  const noExt = extensionAvailable === false;

  let label: string;
  let dotColor: string;
  let tooltipText: string;

  if (isChecking) {
    label = "WCA…";
    dotColor = isDark ? "bg-amber-400" : "bg-amber-500";
    tooltipText = "Verifica sessione in corso…";
  } else if (isOk) {
    label = "WCA";
    dotColor = isDark ? "bg-emerald-400" : "bg-emerald-500";
    tooltipText = "Sessione WCA attiva";
  } else if (noExt) {
    label = "WCA ✕";
    dotColor = isDark ? "bg-red-400" : "bg-red-500";
    tooltipText = "Estensione Chrome non rilevata — installa dalla pagina dedicata";
  } else if (lastError) {
    label = "WCA ✕";
    dotColor = isDark ? "bg-red-400" : "bg-red-500";
    tooltipText = lastError;
  } else {
    label = "WCA ?";
    dotColor = isDark ? "bg-slate-500" : "bg-slate-400";
    tooltipText = "Clicca per verificare la sessione WCA";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => ensureSession()}
            disabled={isChecking}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${
              isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {isChecking ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <div className={`w-2 h-2 rounded-full ${dotColor}`} />
            )}
            <span className="text-[10px]">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

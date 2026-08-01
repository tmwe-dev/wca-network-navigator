import { RefreshCw, Loader2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { OptimusBadge } from "@/components/outreach/OptimusBadge";

export type WhatsAppToolbarProps = {
  isReading: boolean;
  isAvailable: boolean;
  isAuthenticated: boolean;
  readNow: () => void;
  syncProgress: { current: number; total: number; newMessages: number } | null;
};

export function WhatsAppToolbar({
  isReading, isAvailable, isAuthenticated, readNow, syncProgress,
}: WhatsAppToolbarProps) {
  const badgeState = !isAvailable
    ? { variant: "destructive" as const, label: "Ext Off", color: "" }
    : !isAuthenticated
      ? { variant: "outline" as const, label: "Sessione", color: "border-yellow-500 text-yellow-600 bg-yellow-500/10" }
      : { variant: "default" as const, label: "On", color: "" };

  const disabled = isReading || !isAvailable || !isAuthenticated;
  const tooltip = !isAvailable
    ? "Estensione WhatsApp non rilevata"
    : !isAuthenticated
      ? "WhatsApp Web non autenticato — apri web.whatsapp.com"
      : "Sincronizza tutti i messaggi nuovi";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => readNow()}
          disabled={disabled}
          title={tooltip}
          className="gap-1 h-6 text-[10px] px-1.5"
        >
          {isReading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Sincronizza
        </Button>
        <Badge variant={badgeState.variant} className={cn("text-[9px] gap-0.5 h-5 px-1.5 cursor-default", badgeState.color)}>
          {isAvailable ? (isAuthenticated ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />) : <WifiOff className="w-2.5 h-2.5" />}
          {badgeState.label}
        </Badge>
        <OptimusBadge channel="whatsapp" pageType="sidebar" />
      </div>
      {syncProgress && syncProgress.total > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <Progress
            value={(syncProgress.current / syncProgress.total) * 100}
            className="h-1 flex-1 max-w-[120px]"
          />
          <span className="text-[9px] text-muted-foreground whitespace-nowrap">
            {syncProgress.current}/{syncProgress.total} chat • {syncProgress.newMessages} nuovi
          </span>
        </div>
      )}
    </div>
  );
}

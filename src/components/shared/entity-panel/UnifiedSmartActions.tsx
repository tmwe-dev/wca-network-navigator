/**
 * UnifiedSmartActions — Pannello azioni standardizzato per le tre aree
 * (BCA · WCA Partner · CRM Contatti).
 *
 * Mostra due gruppi compatti:
 *   • Comunicazione: Email · WhatsApp · Chiama · Workspace
 *   • Azioni AI:    Cockpit · Deep Search · LinkedIn · Campagna
 *
 * Tutte le azioni che mancano di dato (es. niente email, niente telefono)
 * vengono renderizzate in stato `disabled` invece di scomparire, così la
 * struttura è la stessa in tutte e tre le maschere → coerenza visiva.
 *
 * I callback sono iniettati dal chiamante (vedi useUnifiedEntityActions).
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Mail, Phone, MessageCircle, Briefcase, Send, Sparkles,
  Search, Linkedin, Megaphone, ArrowRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface UnifiedActionHandlers {
  onEmail?: () => void;
  onWhatsApp?: () => void;
  onCall?: () => void;
  onWorkspace?: () => void;
  onCockpit?: () => void;
  onDeepSearch?: () => void;
  onLinkedIn?: () => void;
  onCampaign?: () => void;
}

export interface UnifiedActionFlags {
  hasEmail: boolean;
  hasPhone: boolean;
  hasWhatsApp: boolean;
  waSending?: boolean;
  waAvailable?: boolean;
}

interface Props extends UnifiedActionHandlers, UnifiedActionFlags {
  /** Compatto = h-8; ultra = h-7. Default: compact. */
  density?: "compact" | "ultra";
  className?: string;
}

function ActionBtn({
  icon: Icon, label, onClick, disabled, tone = "primary", busy = false, density = "compact",
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "emerald" | "blue" | "amber";
  busy?: boolean;
  density?: "compact" | "ultra";
}) {
  const toneCls = {
    primary: "border-primary/15 hover:bg-primary/10 [&_svg]:text-primary",
    emerald: "border-emerald-500/15 hover:bg-emerald-500/10 [&_svg]:text-emerald-400",
    blue:    "border-blue-500/15 hover:bg-blue-500/10 [&_svg]:text-blue-400",
    amber:   "border-amber-500/15 hover:bg-amber-500/10 [&_svg]:text-amber-400",
  }[tone];
  return (
    <Button
      variant="outline" size="sm"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={cn(
        density === "ultra" ? "h-7 text-[11px]" : "h-8 text-xs",
        "gap-1.5 justify-start",
        toneCls,
        (disabled || !onClick) && "opacity-40",
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </Button>
  );
}

export function UnifiedSmartActions(props: Props) {
  const {
    hasEmail, hasPhone, hasWhatsApp, waSending = false, waAvailable = true,
    onEmail, onWhatsApp, onCall, onWorkspace,
    onCockpit, onDeepSearch, onLinkedIn, onCampaign,
    density = "compact", className,
  } = props;

  return (
    <div className={cn("space-y-3", className)}>
      {/* COMUNICAZIONE */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
          <Send className="w-3 h-3" /> Comunicazione
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <ActionBtn icon={Mail}          label="Email"     tone="primary" density={density} onClick={hasEmail ? onEmail : undefined} disabled={!hasEmail} />
          <ActionBtn icon={MessageCircle} label="WhatsApp"  tone="emerald" density={density} onClick={hasWhatsApp ? onWhatsApp : undefined} disabled={!hasWhatsApp || !waAvailable} busy={waSending} />
          <ActionBtn icon={Phone}         label="Chiama"    tone="primary" density={density} onClick={hasPhone ? onCall : undefined} disabled={!hasPhone} />
          <ActionBtn icon={Briefcase}     label="Workspace" tone="primary" density={density} onClick={hasEmail ? onWorkspace : undefined} disabled={!hasEmail} />
        </div>
      </div>

      {/* AZIONI AI */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Azioni AI
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <ActionBtn icon={ArrowRight} label="Cockpit"     tone="primary" density={density} onClick={onCockpit} />
          <ActionBtn icon={Search}     label="Deep Search" tone="primary" density={density} onClick={onDeepSearch} />
          <ActionBtn icon={Linkedin}   label="LinkedIn"    tone="blue"    density={density} onClick={onLinkedIn} />
          <ActionBtn icon={Megaphone}  label="Campagna"    tone="amber"   density={density} onClick={onCampaign} />
        </div>
      </div>
    </div>
  );
}

export default UnifiedSmartActions;
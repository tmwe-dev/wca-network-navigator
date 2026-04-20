import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  X, Briefcase, ClipboardList, Sparkles, Linkedin, MessageCircle,
  Megaphone, Trash2, Loader2, Globe, Send, Layers, Link2, Mail,
} from "lucide-react";

export type BulkSourceType = "partner" | "contact" | "business_card";

export interface UnifiedBulkActionBarProps {
  count: number;
  sourceType: BulkSourceType;
  onClear: () => void;

  /* Availability flags — hide button if undefined */
  onWorkspace?: () => void;
  onCockpit?: () => void;
  onEmail?: () => void;
  onWhatsApp?: () => void;
  onLinkedInDM?: () => void;
  onDeepSearch?: () => void;
  onLinkedIn?: () => void;
  onGoogleLogo?: () => void;
  onCampaign?: () => void;
  onDelete?: () => void;
  onDeduplicate?: () => void;
  onWcaMatch?: () => void;

  /* Counts for contextual labels */
  withEmail?: number;
  withPhone?: number;
  withLinkedIn?: number;

  /* Loading states */
  deepSearchLoading?: boolean;
  linkedInLoading?: boolean;
  linkedInDMLoading?: boolean;
  deduplicateLoading?: boolean;
  sendingToWorkspace?: boolean;
  wcaMatchLoading?: boolean;
}

export function UnifiedBulkActionBar({
  count, onClear,
  onWorkspace, onCockpit, onEmail, onWhatsApp, onLinkedInDM,
  onDeepSearch, onLinkedIn, onGoogleLogo, onCampaign,
  onDelete, onDeduplicate, onWcaMatch,
  withEmail = 0, withPhone = 0, withLinkedIn = 0,
  deepSearchLoading, linkedInLoading, linkedInDMLoading, deduplicateLoading, sendingToWorkspace, wcaMatchLoading,
}: UnifiedBulkActionBarProps) {
  if (count === 0) return null;

  const btn = "h-6 px-2 text-[11px] gap-1 text-primary hover:bg-primary/15 hover:text-primary";

  return (
    <div className="px-3 py-1.5 border-b border-primary/15 bg-primary/[0.06] backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-semibold text-primary">{count} sel.</span>

        {onWorkspace && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onWorkspace} disabled={sendingToWorkspace}>
              {sendingToWorkspace ? <Loader2 className="w-3 h-3 animate-spin" /> : <Briefcase className="w-3 h-3" />} Workspace
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Invia al Workspace Email</TooltipContent></Tooltip>
        )}

        {onCockpit && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onCockpit}>
              <ClipboardList className="w-3 h-3" /> Cockpit
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Invia al Cockpit</TooltipContent></Tooltip>
        )}

        {onEmail && withEmail > 0 && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onEmail}>
              <Send className="w-3 h-3" /> Email ({withEmail})
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Invia email</TooltipContent></Tooltip>
        )}

        {onWhatsApp && withPhone > 0 && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onWhatsApp}>
              <MessageCircle className="w-3 h-3" /> WhatsApp ({withPhone})
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Invia WhatsApp</TooltipContent></Tooltip>
        )}

        {onDeepSearch && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onDeepSearch} disabled={deepSearchLoading}>
              {deepSearchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Deep Search
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Arricchisci con Deep Search</TooltipContent></Tooltip>
        )}

        {onLinkedIn && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onLinkedIn} disabled={linkedInLoading}>
              {linkedInLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Linkedin className="w-3 h-3" />} LinkedIn
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Cerca profili LinkedIn</TooltipContent></Tooltip>
        )}

        {onGoogleLogo && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onGoogleLogo}>
              <Globe className="w-3 h-3" /> Logo
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Cerca logo su Google</TooltipContent></Tooltip>
        )}

        {onCampaign && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onCampaign}>
              <Megaphone className="w-3 h-3" /> Campagna
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Aggiungi a Campagna</TooltipContent></Tooltip>
        )}

        {onDeduplicate && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onDeduplicate} disabled={deduplicateLoading}>
              {deduplicateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />} Consolida
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Consolida duplicati</TooltipContent></Tooltip>
        )}

        {onWcaMatch && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className={btn} onClick={onWcaMatch} disabled={wcaMatchLoading}>
              {wcaMatchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} WCA Match
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Verifica associazione WCA</TooltipContent></Tooltip>
        )}

        {onDelete && (
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost"
              className="h-6 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/15"
              onClick={onDelete}>
              <Trash2 className="w-3 h-3" /> Elimina
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Elimina selezionati</TooltipContent></Tooltip>
        )}

        <button onClick={onClear} className="ml-auto hover:bg-primary/20 rounded-full p-0.5 transition-colors text-primary">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

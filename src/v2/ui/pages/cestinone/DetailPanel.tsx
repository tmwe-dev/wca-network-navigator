import * as React from "react";
import {
  Mail, Sparkles, History, ShieldCheck, User, CheckCircle2, Pencil, Clock,
  ExternalLink, Trash2, Megaphone, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";
import type { CestinoItem } from "@/data/cestinone";
import { CHANNEL_META, STATUS_META, TRIGGER_META, PARTNER_TYPE_META } from "./meta";
import { AgentBadge } from "./AgentBadge";
import { PreviewTab, OriginTab, HistoryTab, ChecksTab, RecipientTab } from "./tabs";
import { minutesUntilTomorrow9, minutesUntilNextMonday9 } from "./utils";

export interface DetailPanelProps {
  item: CestinoItem;
  onConfirm: () => void;
  onEdit: () => void;
  onOpenOrigin: () => void;
  onOpenPartner: () => void;
  onRunSherlock: () => void;
  onSnooze: (m: number) => void;
  onCancel: () => void;
  canSnooze: boolean;
}

export function DetailPanel({
  item, onConfirm, onEdit, onOpenOrigin, onOpenPartner, onRunSherlock, onSnooze, onCancel, canSnooze,
}: DetailPanelProps): React.ReactElement {
  const ch = CHANNEL_META[item.channel] ?? CHANNEL_META.other;
  const st = STATUS_META[item.status] ?? STATUS_META.pending;
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  const pt = item.partnerType ? PARTNER_TYPE_META[item.partnerType] : null;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";

  return (
    <>
      <div className={cn("border-b border-l-4 px-4 py-2.5 bg-muted/10", ch.borderL)}>
        <div className="flex items-start gap-3 mb-1.5">
          <h2 className="flex-1 min-w-0 text-base font-semibold leading-snug text-left line-clamp-2">
            {item.subject ?? "(senza oggetto)"}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            <span title={ch.label} className={cn("h-6 w-6 rounded-md flex items-center justify-center", ch.bg)}>
              <ch.Icon className={cn("h-3.5 w-3.5", ch.tone)} />
            </span>
            <Badge variant="outline" className={cn("text-[9px] border", st.tone)}>{st.label}</Badge>
            <span title={tr.label} className={cn("flex items-center", tr.tone)}>
              <tr.Icon className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-left">
          <span className="text-sm font-medium truncate max-w-[260px]">
            {item.partnerName ?? item.recipientName ?? "—"}
          </span>
          {flag && <span className="text-base leading-none" title={item.partnerCountryCode ?? ""}>{flag}</span>}
          {pt && <Badge variant="outline" className={cn("text-[9px] border", pt.tone)}>{pt.label}</Badge>}
          {item.partnerLeadStatus && (
            <Badge variant="outline" className="text-[9px]">Lead: {item.partnerLeadStatus}</Badge>
          )}
          {item.partnerWcaId && (
            <Badge variant="outline" className="text-[9px] gap-1">
              <Hash className="h-2.5 w-2.5" />WCA #{item.partnerWcaId}
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground truncate ml-1">
            → {item.recipientHandle ?? "—"}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {item.campaignName && (
              <Badge variant="secondary" className="text-[9px] gap-1" title={item.campaignName}>
                <Megaphone className="h-2.5 w-2.5" />
                <span className="truncate max-w-[120px]">{item.campaignName}</span>
              </Badge>
            )}
            {item.agentName && (
              <AgentBadge name={item.agentName} />
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="preview" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="mx-3 mt-2 self-start">
          <TabsTrigger value="preview" className="text-xs gap-1.5">
            <Mail className="h-3 w-3" /> Anteprima
          </TabsTrigger>
          <TabsTrigger value="origin" className="text-xs gap-1.5">
            <Sparkles className="h-3 w-3" /> Origine
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5">
            <History className="h-3 w-3" /> Storico
          </TabsTrigger>
          <TabsTrigger value="checks" className="text-xs gap-1.5">
            <ShieldCheck className="h-3 w-3" /> Controlli
          </TabsTrigger>
          <TabsTrigger value="recipient" className="text-xs gap-1.5">
            <User className="h-3 w-3" /> Destinatario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <PreviewTab item={item} />
        </TabsContent>
        <TabsContent value="origin" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <OriginTab item={item} onOpenOrigin={onOpenOrigin} />
        </TabsContent>
        <TabsContent value="history" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <HistoryTab item={item} />
        </TabsContent>
        <TabsContent value="checks" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <ChecksTab item={item} onRunSherlock={onRunSherlock} />
        </TabsContent>
        <TabsContent value="recipient" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <RecipientTab item={item} onOpenPartner={onOpenPartner} />
        </TabsContent>
      </Tabs>

      <footer className="px-3 py-2 border-t bg-muted/20 flex items-center gap-1.5 flex-wrap shrink-0">
        <Button size="sm" className="h-8 gap-1.5" onClick={onConfirm}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Conferma
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Modifica
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5" disabled={!canSnooze}
              title={canSnooze ? "Rinvia" : "Snooze non disponibile"}>
              <Clock className="h-3.5 w-3.5" /> Rinvia
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onSnooze(60)}>+1 ora</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(60 * 4)}>+4 ore</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(minutesUntilTomorrow9())}>Domani 09:00</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(minutesUntilNextMonday9())}>Lunedì 09:00</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onOpenOrigin}>
          <ExternalLink className="h-3.5 w-3.5" /> Apri origine
        </Button>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive hover:text-destructive ml-auto" onClick={onCancel}>
          <Trash2 className="h-3.5 w-3.5" /> Annulla
        </Button>
      </footer>
    </>
  );
}
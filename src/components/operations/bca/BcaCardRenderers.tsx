import { Mail, MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

interface CardProps {
  card: BusinessCardWithPartner;
  isSelected: boolean;
  onToggle: (id: string) => void;
  groupCompanyName: string;
  onSendEmail: (params: { email: string; name?: string; company: string }) => void;
  onSendWhatsApp: (params: { phone: string; contactName?: string; companyName: string; sourceType: string; sourceId: string }) => void;
}

export function BcaCompactCard({ card, isSelected, onToggle, groupCompanyName, onSendEmail, onSendWhatsApp }: CardProps) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all", isSelected ? "bg-primary/[0.06]" : "hover:bg-muted/20")} onClick={() => onToggle(card.id)}>
      <Checkbox checked={isSelected} onCheckedChange={() => onToggle(card.id)} className="w-3 h-3" />
      <span className="text-xs font-medium text-foreground truncate flex-1">{card.contact_name || "—"}</span>
      {card.position && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{card.position}</span>}
      <div className="flex items-center gap-1 flex-shrink-0">
        {card.email && (
          <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><button onClick={(e) => { e.stopPropagation(); onSendEmail({ email: card.email!, name: card.contact_name || undefined, company: groupCompanyName }); }} className="hover:scale-110 transition-transform"><Mail className="w-3 h-3 text-primary/60 hover:text-primary" /></button></TooltipTrigger><TooltipContent className="text-[10px]">Invia email a {card.email}</TooltipContent></Tooltip></TooltipProvider>
        )}
        {(card.phone || card.mobile) && (
          <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><button onClick={(e) => { e.stopPropagation(); onSendWhatsApp({ phone: (card.mobile || card.phone)!, contactName: card.contact_name || undefined, companyName: groupCompanyName, sourceType: "contact", sourceId: card.id }); }} className="hover:scale-110 transition-transform"><MessageCircle className="w-3 h-3 text-emerald-500/60 hover:text-emerald-500" /></button></TooltipTrigger><TooltipContent className="text-[10px]">WhatsApp {card.mobile || card.phone}</TooltipContent></Tooltip></TooltipProvider>
        )}
      </div>
    </div>
  );
}

export function BcaGridCard({ card, isSelected, onToggle, groupCompanyName, onSendEmail, onSendWhatsApp }: CardProps) {
  return (
    <div className={cn("relative rounded-lg border p-3 cursor-pointer transition-all duration-150 hover:shadow-sm", isSelected ? "border-primary/40 bg-primary/[0.06] shadow-sm" : "border-border/40 bg-card/30 hover:border-border/60")} onClick={() => onToggle(card.id)}>
      <div className="absolute top-2 right-2"><Checkbox checked={isSelected} onCheckedChange={() => onToggle(card.id)} className="w-3.5 h-3.5" /></div>
      <div className="space-y-1.5 pr-6">
        <div className="text-xs font-semibold text-foreground truncate">{card.contact_name || "—"}</div>
        {card.position && <div className="text-[10px] text-muted-foreground truncate">{card.position}</div>}
        <div className="flex items-center gap-1 mt-1">
          {card.email && (
            <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><button onClick={(e) => { e.stopPropagation(); onSendEmail({ email: card.email!, name: card.contact_name || undefined, company: groupCompanyName }); }} className="hover:scale-110 transition-transform"><Mail className="w-3 h-3 text-primary/60 hover:text-primary" /></button></TooltipTrigger><TooltipContent className="text-[10px]">Invia email a {card.email}</TooltipContent></Tooltip></TooltipProvider>
          )}
          {(card.phone || card.mobile) && (
            <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild><button onClick={(e) => { e.stopPropagation(); onSendWhatsApp({ phone: (card.mobile || card.phone)!, contactName: card.contact_name || undefined, companyName: groupCompanyName, sourceType: "contact", sourceId: card.id }); }} className="hover:scale-110 transition-transform"><MessageCircle className="w-3 h-3 text-emerald-500/60 hover:text-emerald-500" /></button></TooltipTrigger><TooltipContent className="text-[10px]">WhatsApp {card.mobile || card.phone}</TooltipContent></Tooltip></TooltipProvider>
          )}
        </div>
        {card.event_name && <div className="text-[9px] text-muted-foreground/60 truncate mt-1">📍 {card.event_name}</div>}
      </div>
    </div>
  );
}

export function BcaExpandedCard({ card, isSelected, onToggle, groupCompanyName, onSendEmail, onSendWhatsApp }: CardProps) {
  return (
    <div className={cn("relative rounded-lg border p-4 cursor-pointer transition-all hover:shadow-sm", isSelected ? "border-primary/40 bg-primary/[0.06]" : "border-border/40 bg-card/30 hover:border-border/60")} onClick={() => onToggle(card.id)}>
      <div className="absolute top-2 right-2"><Checkbox checked={isSelected} onCheckedChange={() => onToggle(card.id)} className="w-3.5 h-3.5" /></div>
      <div className="space-y-2 pr-6">
        <div className="text-sm font-semibold text-foreground">{card.contact_name || "—"}</div>
        {card.position && <div className="text-xs text-muted-foreground">{card.position}</div>}
        <div className="flex flex-wrap gap-2 mt-1">
          {card.email && <button onClick={(e) => { e.stopPropagation(); onSendEmail({ email: card.email!, name: card.contact_name || undefined, company: groupCompanyName }); }} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-mono hover:bg-primary/20 transition-colors cursor-pointer">{card.email}</button>}
          {(card.phone || card.mobile) && <button onClick={(e) => { e.stopPropagation(); onSendWhatsApp({ phone: (card.mobile || card.phone)!, contactName: card.contact_name || undefined, companyName: groupCompanyName, sourceType: "contact", sourceId: card.id }); }} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono hover:bg-emerald-500/20 transition-colors cursor-pointer">{card.mobile || card.phone}</button>}
        </div>
        {card.event_name && <div className="text-[10px] text-muted-foreground/60 mt-1">📍 {card.event_name}</div>}
        {card.location && <div className="text-[10px] text-muted-foreground/60">📌 {card.location}</div>}
        {card.notes && <div className="text-[10px] text-muted-foreground/50 italic mt-1">{card.notes}</div>}
      </div>
    </div>
  );
}

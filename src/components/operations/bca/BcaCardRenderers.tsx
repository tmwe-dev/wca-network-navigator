import { Mail, MessageCircle, GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { BCA_DRAG_MIME } from "@/components/contacts/bca/bcaDragContext";

/**
 * Formatta il testo OCR/notes del biglietto in righe leggibili.
 * Riconosce coppie "Label: valore" separate da `|` o `;` e evidenzia
 * le etichette in azzurro fosforescente. Il resto (rumore OCR) viene
 * mostrato come paragrafo grigio in fondo.
 */
function BcaNotesFormatted({ text }: { text: string }) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  // split principale su `|` poi su `;`
  const segments = cleaned
    .split(/\s*\|\s*|\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const KNOWN = /^(Evento|Event|Data|Date|Indirizzo|Address|Location|Sito|Website|Tel|Phone|Mobile|Email|Note|Notes|Company|Azienda|Ruolo|Position|Settore|Industry|Stand|Booth|Hall|Padiglione)\b/i;

  const structured: Array<{ label: string; value: string }> = [];
  const noise: string[] = [];

  for (const seg of segments) {
    const m = seg.match(/^([A-Za-zÀ-ÿ ]{2,30})\s*[:=]\s*(.+)$/);
    if (m && KNOWN.test(m[1].trim())) {
      structured.push({ label: m[1].trim(), value: m[2].trim() });
    } else if (seg.length > 0) {
      noise.push(seg);
    }
  }

  if (structured.length === 0 && noise.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-border/30 bg-background/40 p-2.5">
      {structured.length > 0 && (
        <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
          {structured.map((row, i) => (
            <div key={i} className="contents">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400 [text-shadow:0_0_6px_hsl(190_100%_60%/0.6)]">
                {row.label}
              </dt>
              <dd className="text-[11px] text-foreground/90 break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {noise.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[10px] text-muted-foreground/60 hover:text-muted-foreground list-none flex items-center gap-1">
            <span className="text-cyan-400/70">▸</span>
            <span>Testo OCR grezzo ({noise.length} frammenti)</span>
          </summary>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/50 italic break-words">
            {noise.join(" · ")}
          </p>
        </details>
      )}
    </div>
  );
}

interface CardProps {
  card: BusinessCardWithPartner;
  isSelected: boolean;
  onToggle: (id: string) => void;
  groupCompanyName: string;
  onSendEmail: (params: { email: string; name?: string; company: string }) => void;
  onSendWhatsApp: (params: { phone: string; contactName?: string; companyName?: string; sourceType?: "contact" | "partner" | "prospect"; sourceId?: string }) => void;
  /** When true, the card opens the detail panel (instead of toggling selection). Used by the unified hub. */
  onOpenDetail?: (id: string) => void;
  /** When true, the grid card exposes a 6-dots drag handle that drags this card by id. */
  enableDrag?: boolean;
}

export function BcaCompactCard({ card, isSelected, onToggle, groupCompanyName, onSendEmail, onSendWhatsApp, onOpenDetail, enableDrag }: CardProps) {
  const handleClick = () => {
    if (onOpenDetail) onOpenDetail(card.id);
    else onToggle(card.id);
  };
  return (
    <div className={cn("group relative flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all", isSelected ? "bg-primary/[0.06]" : "hover:bg-muted/20")} onClick={handleClick}>
      {enableDrag && (
        <button
          type="button"
          draggable
          aria-label="Trascina sul pannello azioni"
          title="Trascina sulle azioni intelligenti"
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData(BCA_DRAG_MIME, card.id);
            e.dataTransfer.setData("text/plain", card.id);
          }}
          className="inline-flex items-center justify-center w-4 h-4 rounded text-muted-foreground/60 hover:text-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <GripVertical className="w-3 h-3" />
        </button>
      )}
      <Checkbox checked={isSelected} onCheckedChange={() => onToggle(card.id)} onClick={(e) => e.stopPropagation()} className="w-3 h-3" />
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

export function BcaGridCard({ card, isSelected, onToggle, groupCompanyName, onSendEmail, onSendWhatsApp, onOpenDetail, enableDrag }: CardProps) {
  const handleClick = () => {
    if (onOpenDetail) onOpenDetail(card.id);
    else onToggle(card.id);
  };
  return (
    <div
      className={cn(
        "group relative rounded-lg border p-3 transition-all duration-150 hover:shadow-sm cursor-pointer",
        isSelected ? "border-primary/40 bg-primary/[0.06] shadow-sm" : "border-border/40 bg-card/30 hover:border-border/60",
      )}
      onClick={handleClick}
    >
      {enableDrag && (
        <button
          type="button"
          draggable
          aria-label="Trascina sul pannello azioni"
          title="Trascina sulle azioni intelligenti"
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData(BCA_DRAG_MIME, card.id);
            e.dataTransfer.setData("text/plain", card.id);
          }}
          className="absolute top-1.5 left-1.5 z-10 inline-flex items-center justify-center w-5 h-5 rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing opacity-60 group-hover:opacity-100 transition-opacity"
        >
          <span className="relative inline-flex">
            <GripVertical className="w-3 h-3" />
            <GripVertical className="w-3 h-3 -ml-1.5" />
          </span>
        </button>
      )}
      <div className="absolute top-2 right-2"><Checkbox checked={isSelected} onCheckedChange={() => onToggle(card.id)} onClick={(e) => e.stopPropagation()} className="w-3.5 h-3.5" /></div>
      <div className={cn("space-y-1.5 pr-6", enableDrag && "pl-5")}>
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

export function BcaExpandedCard({ card, isSelected, onToggle, groupCompanyName, onSendEmail, onSendWhatsApp, onOpenDetail, enableDrag }: CardProps) {
  const handleClick = () => {
    if (onOpenDetail) onOpenDetail(card.id);
    else onToggle(card.id);
  };
  return (
    <div className={cn("group relative rounded-lg border p-4 cursor-pointer transition-all hover:shadow-sm", isSelected ? "border-primary/40 bg-primary/[0.06]" : "border-border/40 bg-card/30 hover:border-border/60")} onClick={handleClick}>
      {enableDrag && (
        <button
          type="button"
          draggable
          aria-label="Trascina sul pannello azioni"
          title="Trascina sulle azioni intelligenti"
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData(BCA_DRAG_MIME, card.id);
            e.dataTransfer.setData("text/plain", card.id);
          }}
          className="absolute top-1.5 left-1.5 z-10 inline-flex items-center justify-center w-5 h-5 rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing opacity-60 group-hover:opacity-100 transition-opacity"
        >
          <span className="relative inline-flex">
            <GripVertical className="w-3 h-3" />
            <GripVertical className="w-3 h-3 -ml-1.5" />
          </span>
        </button>
      )}
      <div className="absolute top-2 right-2"><Checkbox checked={isSelected} onCheckedChange={() => onToggle(card.id)} onClick={(e) => e.stopPropagation()} className="w-3.5 h-3.5" /></div>
      <div className={cn("space-y-2 pr-6", enableDrag && "pl-5")}>
        <div className="text-sm font-semibold text-foreground">{card.contact_name || "—"}</div>
        {card.position && <div className="text-xs text-muted-foreground">{card.position}</div>}
        <div className="flex flex-wrap gap-2 mt-1">
          {card.email && <button onClick={(e) => { e.stopPropagation(); onSendEmail({ email: card.email!, name: card.contact_name || undefined, company: groupCompanyName }); }} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-mono hover:bg-primary/20 transition-colors cursor-pointer">{card.email}</button>}
          {(card.phone || card.mobile) && <button onClick={(e) => { e.stopPropagation(); onSendWhatsApp({ phone: (card.mobile || card.phone)!, contactName: card.contact_name || undefined, companyName: groupCompanyName, sourceType: "contact", sourceId: card.id }); }} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono hover:bg-emerald-500/20 transition-colors cursor-pointer">{card.mobile || card.phone}</button>}
        </div>
        {card.event_name && <div className="text-[10px] text-muted-foreground/60 mt-1">📍 {card.event_name}</div>}
        {card.location && <div className="text-[10px] text-muted-foreground/60">📌 {card.location}</div>}
        {card.notes && <BcaNotesFormatted text={card.notes} />}
      </div>
    </div>
  );
}

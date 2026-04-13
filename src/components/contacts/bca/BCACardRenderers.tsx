import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Mail, Phone, User, MapPin, Handshake, FileText, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { BCAQuickActions, STATUS_COLORS, STATUS_LABELS, getCardOriginClasses, getCardCountryCode, countryFlag, getWcaYear } from "./bcaUtils";

/* ═══ Compact List Row ═══ */
export function CompactRow({ card, isSelected, onSelect, onShowDetail, onGoogleLogo }: {
  card: BusinessCardWithPartner; isSelected: boolean; onSelect: () => void; onShowDetail: () => void; onGoogleLogo: () => void;
}) {
  const sc = STATUS_COLORS[card.match_status] || STATUS_COLORS.pending;
  const accent = getCardOriginClasses(card);
  const cardCountry = getCardCountryCode(card);
  const flag = cardCountry ? countryFlag(cardCountry) : "";
  const wcaYear = getWcaYear(card);
  const city = card.partner?.enrichment_data?.city || card.location || "";

  return (
    <div className={cn(
      "relative flex flex-col gap-0.5 px-3 py-2 rounded-lg transition-colors hover:bg-muted/40 border border-transparent overflow-hidden cursor-pointer group/row",
      isSelected && "bg-primary/10 border-primary/20",
    )} onClick={onShowDetail}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l", accent.border)} />
      <div className="flex items-center gap-2 min-w-0">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} className="h-3.5 w-3.5 shrink-0" onClick={(e) => e.stopPropagation()} />
        {flag && <span className="text-sm shrink-0">{flag}</span>}
        <span className="text-sm font-semibold text-foreground truncate flex-1">{card.company_name || "—"}</span>
        <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0", sc)}>{STATUS_LABELS[card.match_status] || "Attesa"}</span>
        {card.email && <Mail className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
        {(card.phone || card.mobile) && <Phone className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
        <BCAQuickActions card={card} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-8 min-w-0">
        {card.contact_name && <span className="flex items-center gap-1 shrink-0"><User className="w-3 h-3" />{card.contact_name}</span>}
        {card.position && <span className="truncate max-w-[120px]">{card.position}</span>}
        {city && <span className="flex items-center gap-0.5 shrink-0"><MapPin className="w-2.5 h-2.5" />{city}</span>}
        {card.event_name && <span className="flex items-center gap-0.5 truncate max-w-[120px]"><Handshake className="w-2.5 h-2.5 text-primary" />{card.event_name}</span>}
        {wcaYear && <Badge variant="outline" className="text-[8px] h-4 px-1 border-chart-1/20 text-chart-1 shrink-0">WCA {wcaYear}</Badge>}
      </div>
    </div>
  );
}

/* ═══ Card Grid Item ═══ */
export function CardGridItem({ card, isSelected, onSelect, onShowDetail, onGoogleLogo }: {
  card: BusinessCardWithPartner; isSelected: boolean; onSelect: () => void; onShowDetail: () => void; onGoogleLogo: () => void;
}) {
  const sc = STATUS_COLORS[card.match_status] || STATUS_COLORS.pending;
  const hasPhoto = !!card.photo_url;
  const accent = getCardOriginClasses(card);
  const cardCountry = getCardCountryCode(card);
  const flag = cardCountry ? countryFlag(cardCountry) : "";
  const wcaYear = getWcaYear(card);

  return (
    <div className={cn(
      "relative bg-gradient-to-br from-primary/5 via-card to-primary/5 border rounded-xl overflow-hidden transition-all cursor-pointer",
      isSelected ? "border-primary/40 shadow-sm" : "border-primary/10 hover:border-primary/20",
    )} onClick={onShowDetail}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l z-10", accent.border)} />
      {hasPhoto ? (
        <AspectRatio ratio={16 / 9}><img src={card.photo_url!} alt="BCA" className="w-full h-full object-cover" loading="lazy" /></AspectRatio>
      ) : (
        <div className="h-8 bg-gradient-to-r from-emerald-500/10 to-primary/10 flex items-center justify-center gap-1">
          <FileText className="w-3 h-3 text-emerald-400" /><span className="text-[9px] text-emerald-400 font-medium">Da file</span>
        </div>
      )}
      <div className="p-2.5 space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <Checkbox checked={isSelected} onCheckedChange={onSelect} className="h-3.5 w-3.5 mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate flex items-center gap-1">{flag && <span className="text-xs">{flag}</span>}{card.company_name || "—"}</p>
            <p className="text-[11px] text-muted-foreground truncate">{card.contact_name || "—"}{card.position ? ` · ${card.position}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge className={cn("text-[8px] px-1 py-0", sc)}>{STATUS_LABELS[card.match_status] || "Attesa"}</Badge>
          {wcaYear && <Badge variant="outline" className="text-[8px] px-1 py-0 border-chart-1/20 text-chart-1">WCA {wcaYear}</Badge>}
          {card.email && <Mail className="w-3 h-3 text-muted-foreground/40" />}
          {(card.phone || card.mobile) && <Phone className="w-3 h-3 text-muted-foreground/40" />}
        </div>
      </div>
    </div>
  );
}

/* ═══ Expanded Card ═══ */
export function ExpandedCardItem({ card, isSelected, onSelect, onShowDetail, onGoogleLogo }: {
  card: BusinessCardWithPartner; isSelected: boolean; onSelect: () => void; onShowDetail: () => void; onGoogleLogo: () => void;
}) {
  const sc = STATUS_COLORS[card.match_status] || STATUS_COLORS.pending;
  const hasPhoto = !!card.photo_url;
  const accent = getCardOriginClasses(card);
  const cardCountry = getCardCountryCode(card);
  const flag = cardCountry ? countryFlag(cardCountry) : "";
  const wcaYear = getWcaYear(card);

  return (
    <div className={cn(
      "relative bg-gradient-to-br from-primary/5 via-card to-primary/5 border rounded-xl overflow-hidden transition-all cursor-pointer",
      isSelected ? "border-primary/40 shadow-sm" : "border-primary/10 hover:border-primary/20",
    )} onClick={onShowDetail}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l z-10", accent.border)} />
      <div className="flex gap-3 p-3">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} className="h-3.5 w-3.5 mt-1 shrink-0" onClick={(e) => e.stopPropagation()} />
        {hasPhoto && (
          <div className="w-28 shrink-0 rounded-lg overflow-hidden border border-border/30">
            <AspectRatio ratio={16 / 9}><img src={card.photo_url!} alt="BCA" className="w-full h-full object-cover" loading="lazy" /></AspectRatio>
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold truncate flex items-center gap-1.5">{flag && <span>{flag}</span>}{card.company_name || "—"}</p>
          <p className="text-[11px] text-muted-foreground truncate">{card.contact_name || "—"}{card.position ? ` · ${card.position}` : ""}</p>
          {card.event_name && (
            <div className="flex items-center gap-1">
              <Handshake className="w-3 h-3 text-primary shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">{card.event_name}</span>
              {card.met_at && <span className="text-[10px] text-muted-foreground/60">{format(new Date(card.met_at), "dd MMM yy", { locale: it })}</span>}
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <Badge className={cn("text-[8px] px-1 py-0", sc)}>{STATUS_LABELS[card.match_status] || "Attesa"}</Badge>
            {wcaYear && <Badge variant="outline" className="text-[8px] px-1 py-0 border-chart-1/20 text-chart-1">WCA {wcaYear}</Badge>}
            {card.email && <Mail className="w-3 h-3 text-muted-foreground/40" />}
            {(card.phone || card.mobile) && <Phone className="w-3 h-3 text-muted-foreground/40" />}
            {card.partner && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/20 text-emerald-400">
                <Building2 className="w-2.5 h-2.5 mr-0.5" />{card.partner.company_name}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

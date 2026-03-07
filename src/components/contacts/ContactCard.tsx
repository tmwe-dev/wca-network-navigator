import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Phone, AlertTriangle, MessageCircle, User, Building2, MapPin, Tag
} from "lucide-react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { clean, formatPhone, getContactQuality } from "./contactHelpers";
import type { LeadStatus } from "@/hooks/useContacts";

interface ContactCardProps {
  c: any;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

export function ContactCard({ c, isActive, isSelected, onSelect, onToggle }: ContactCardProps) {
  const cName = clean(c.company_name);
  const cContact = clean(c.name);
  const cEmail = clean(c.email);
  const cPhone = clean(c.phone);
  const cMobile = clean(c.mobile);
  const cPosition = clean(c.position);
  const cCity = clean(c.city);
  const cZip = clean(c.zip_code);
  const cOrigin = clean(c.origin);
  const quality = getContactQuality(c);
  const displayCompany = cName || "Senza azienda";
  const waPhone = cMobile || cPhone;
  const cityDisplay = [cCity, cZip].filter(Boolean).join(", ");

  return (
    <div
      className={`group relative rounded-lg border p-2.5 text-xs cursor-pointer transition-all ${
        isActive
          ? "border-primary bg-primary/15 shadow-md"
          : isSelected
          ? "border-primary/40 bg-primary/10 shadow-sm"
          : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          className="mt-0.5"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-primary shrink-0" />
            <span className={`font-bold truncate ${!cName ? "text-muted-foreground italic" : "text-foreground"}`}>
              {displayCompany}
            </span>
            {quality === "poor" && (
              <span title="Dati incompleti"><AlertTriangle className="w-3 h-3 text-destructive shrink-0" /></span>
            )}
          </div>
          {cContact && (
            <div className="flex items-center gap-1.5 text-foreground">
              <User className="w-3 h-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{cContact}</span>
              {cPosition && <span className="text-[10px] text-primary font-medium">• {cPosition}</span>}
            </div>
          )}
          {(cityDisplay || cOrigin) && (
            <div className="flex items-center gap-2 text-foreground">
              {cityDisplay && (
                <span className="inline-flex items-center gap-1 text-[10px]">
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{cityDisplay}</span>
                </span>
              )}
              {cOrigin && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary font-semibold border-0">
                  <Tag className="w-2.5 h-2.5 mr-0.5" />{cOrigin}
                </Badge>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
            {cEmail && (
              <a href={`mailto:${cEmail}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium" title={cEmail}>
                <Mail className="w-3.5 h-3.5" /><span className="truncate max-w-[150px]">{cEmail}</span>
              </a>
            )}
            {waPhone && (
              <a href={`https://wa.me/${formatPhone(waPhone)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium" title={`WhatsApp: ${waPhone}`}>
                <MessageCircle className="w-3.5 h-3.5" /><span>WA</span>
              </a>
            )}
            {cPhone && (
              <a href={`tel:${cPhone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium" title={cPhone}>
                <Phone className="w-3.5 h-3.5" /><span className="truncate max-w-[120px]">{cPhone}</span>
              </a>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border/50 pt-1 mt-1">
            <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
            {c.interaction_count > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-chart-3/20 text-chart-3">
                <MessageCircle className="w-3 h-3" />{c.interaction_count}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                <MessageCircle className="w-3 h-3" />0
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

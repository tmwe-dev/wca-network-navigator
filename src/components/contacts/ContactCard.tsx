import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, MessageCircle, User, Building2, MapPin, Tag, Sparkles, Handshake
} from "lucide-react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { clean, getContactQuality } from "./contactHelpers";
import type { LeadStatus } from "@/hooks/useContacts";

interface ContactCardProps {
  c: any;
  isActive: boolean;
  isSelected: boolean;
  hasBusinessCard?: boolean;
  onSelect: () => void;
  onToggle: () => void;
  index?: number;
}

export function ContactCard({ c, isActive, isSelected, hasBusinessCard, onSelect, onToggle, index }: ContactCardProps) {
  const cName = clean(c.company_name);
  const cContact = clean(c.name);
  const cPosition = clean(c.position);
  const cCity = clean(c.city);
  const cOrigin = clean(c.origin);
  const quality = getContactQuality(c);
  const isAiProcessed = !!c.deep_search_at;
  const cCompanyAlias = clean(c.company_alias);
  const cContactAlias = clean(c.contact_alias);
  const hasAlias = !!cCompanyAlias || !!cContactAlias;

  const displayCompany = cCompanyAlias || cName || "Senza azienda";

  return (
    <div
      className={`group relative rounded-lg border p-2 text-xs cursor-pointer transition-all ${
        isActive
          ? "border-primary bg-primary/15 shadow-md"
          : isSelected
          ? "border-primary/40 bg-primary/10 shadow-sm"
          : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        {/* Index + Checkbox */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          {typeof index === "number" && (
            <span className="text-[9px] text-muted-foreground font-mono">#{index + 1}</span>
          )}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Company */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-primary shrink-0" />
            <span className={`font-bold truncate ${!cName && !cCompanyAlias ? "text-muted-foreground italic" : "text-foreground"}`}>
              {displayCompany}
            </span>
            {hasAlias && <Sparkles className="w-3 h-3 text-accent-foreground shrink-0 opacity-70" />}
            {quality === "poor" && (
              <span title="Dati incompleti"><AlertTriangle className="w-3 h-3 text-destructive shrink-0" /></span>
            )}
          </div>

          {/* Show original name if alias replaced it */}
          {cCompanyAlias && cName && cCompanyAlias !== cName && (
            <span className="text-[10px] text-muted-foreground ml-[18px] truncate block">{cName}</span>
          )}

          {/* Contact name + position */}
          {(cContact || cContactAlias) && (
            <div className="flex items-center gap-1.5 text-foreground/80">
              <User className="w-3 h-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{cContactAlias || cContact}</span>
              {cContactAlias && cContact && cContactAlias !== cContact && (
                <span className="text-[10px] text-muted-foreground truncate">({cContact})</span>
              )}
              {cPosition && <span className="text-[10px] text-primary font-medium">• {cPosition}</span>}
            </div>
          )}

          {/* Footer: city, origin, interactions */}
          <div className="flex items-center gap-2 pt-0.5">
            {cCity && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate max-w-[100px]">{cCity}</span>
              </span>
            )}
            {cOrigin && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary font-semibold border-0">
                <Tag className="w-2.5 h-2.5 mr-0.5" />{cOrigin}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {hasBusinessCard && (
                <span title="Incontrato personalmente">
                  <Handshake className="w-3 h-3 text-emerald-400" />
                </span>
              )}
              <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0 rounded-full ${
                c.interaction_count > 0 ? "bg-chart-3/20 text-chart-3" : "bg-muted text-muted-foreground"
              }`}>
                <MessageCircle className="w-2.5 h-2.5" />{c.interaction_count || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

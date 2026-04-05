import { Checkbox } from "@/components/ui/checkbox";
import { useContactDrawer } from "@/contexts/ContactDrawerContext";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, MessageCircle, User, Building2, MapPin, Tag, Sparkles, Handshake,
  Globe2, Linkedin, Briefcase
} from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { InteractionMarkers, type InteractionMarker } from "./InteractionMarkers";
import { clean, getContactQuality } from "./contactHelpers";
import type { LeadStatus } from "@/hooks/useContacts";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ContactCardProps {
  c: any;
  isActive: boolean;
  isSelected: boolean;
  hasBusinessCard?: boolean;
  onSelect: () => void;
  onToggle: () => void;
  index?: number;
  interactions?: InteractionMarker[];
}

/** Returns true if the contact is "in holding pattern" (not new) */
function isInHoldingPattern(status: string | undefined): boolean {
  return !!status && status !== "new";
}

export function ContactCard({ c, isActive, isSelected, hasBusinessCard, onSelect, onToggle, index, interactions }: ContactCardProps) {
  const { open: openDrawer } = useContactDrawer();
  const cName = clean(c.company_name);
  const cContact = clean(c.name);
  const cPosition = clean(c.position);
  const cCity = clean(c.city);
  const cOrigin = clean(c.origin);
  const quality = getContactQuality(c);
  const isAiProcessed = !!c.deep_search_at;
  const cCompanyAlias = clean(c.company_alias);
  const cContactAlias = clean(c.contact_alias);
  const displayCompany = cCompanyAlias || cName || "Senza azienda";
  const displayContact = cContactAlias || cContact;

  const ed = c.enrichment_data;
  const linkedinUrl = ed?.linkedin_url;
  const companyWebsite = ed?.company_website;
  const inHolding = isInHoldingPattern(c.lead_status);
  const lastDate = c.last_interaction_at;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "group flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer border-b border-border/30 transition-colors",
          inHolding && "border-l-2 border-l-muted-foreground/40",
          isActive
            ? isAiProcessed
              ? "bg-amber-500/15"
              : "bg-primary/15"
            : isSelected
            ? "bg-primary/5"
            : "hover:bg-muted/40"
        )}
        onClick={onSelect}
        onDoubleClick={() => openDrawer({ sourceType: "contact", sourceId: c.id })}
      >
        {/* Index + Checkbox */}
        <div className="flex items-center gap-1 shrink-0 w-[42px]">
          {typeof index === "number" && (
            <span className="text-[9px] text-muted-foreground font-mono w-[18px] text-right">#{index + 1}</span>
          )}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        </div>

        {/* Company — fixed width */}
        <div className="flex items-center gap-1 w-[180px] shrink-0 min-w-0">
          <Building2 className="w-3 h-3 text-primary shrink-0" />
          <span className={`font-semibold truncate ${!cName && !cCompanyAlias ? "text-muted-foreground italic" : "text-foreground"}`}>
            {displayCompany}
          </span>
          {isAiProcessed && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
          {quality === "poor" && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
        </div>

        {/* Contact + position */}
        <div className="flex items-center gap-1 w-[160px] shrink-0 min-w-0">
          {displayContact ? (
            <>
              <User className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate text-foreground/80">{displayContact}</span>
              {cPosition && <span className="text-[10px] text-primary font-medium truncate">• {cPosition}</span>}
            </>
          ) : (
            <span className="text-muted-foreground italic">—</span>
          )}
        </div>

        {/* City */}
        <div className="flex items-center gap-0.5 w-[100px] shrink-0 min-w-0">
          {cCity ? (
            <>
              <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{cCity}</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>

        {/* Origin badge */}
        <div className="w-[70px] shrink-0">
          {cOrigin ? (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary font-semibold border-0 truncate max-w-full">
              {cOrigin}
            </Badge>
          ) : null}
        </div>

        {/* Last interaction date */}
        {lastDate && (
          <span className="text-[9px] text-muted-foreground shrink-0">
            {format(new Date(lastDate), "dd/MM", { locale: it })}
          </span>
        )}

        {/* Right indicators */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {linkedinUrl && (
            <span className="p-0.5 rounded bg-[hsl(210,80%,55%)]/10">
              <Linkedin className="w-2.5 h-2.5 text-[hsl(210,80%,55%)]" />
            </span>
          )}
          {companyWebsite && (
            <span className="p-0.5 rounded bg-emerald-500/10">
              <Globe2 className="w-2.5 h-2.5 text-emerald-400" />
            </span>
          )}
          {hasBusinessCard && (
            <Handshake className="w-3 h-3 text-emerald-400" />
          )}
          <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0 rounded-full ${
            c.interaction_count > 0 ? "bg-chart-3/20 text-chart-3" : "bg-muted text-muted-foreground"
          }`}>
            <MessageCircle className="w-2.5 h-2.5" />{c.interaction_count || 0}
          </span>
        </div>
      </div>

      {/* Interaction markers row */}
      {interactions && interactions.length > 0 && (
        <div className="pl-[50px] pb-1 pt-0.5 border-b border-border/20">
          <InteractionMarkers markers={interactions} maxVisible={6} />
        </div>
      )}
    </div>
  );
}

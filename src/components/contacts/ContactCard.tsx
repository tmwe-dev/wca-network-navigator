import { Checkbox } from "@/components/ui/checkbox";
import { useContactDrawer } from "@/contexts/ContactDrawerContext";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, MessageCircle, User, Sparkles, Handshake,
  Globe2, Linkedin, Mail,
} from "lucide-react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { clean, getContactQuality, countryFlag } from "./contactHelpers";
import type { LeadStatus } from "@/hooks/useContacts";
import { cn } from "@/lib/utils";
import { CONTACT_GRID_COLS, CONTACT_GRID_CLASS } from "./contactGridLayout";

interface ContactCardProps {
  c: any;
  isActive: boolean;
  isSelected: boolean;
  hasBusinessCard?: boolean;
  onSelect: () => void;
  onToggle: () => void;
  index?: number;
  onFilterClick?: (field: string, value: string) => void;
}

function isInHoldingPattern(status: string | undefined): boolean {
  return !!status && status !== "new";
}

/** Clickable value that triggers a filter */
function Filterable({ field, value, children, onFilterClick, className }: {
  field: string; value: string | null; children: React.ReactNode;
  onFilterClick?: (field: string, value: string) => void; className?: string;
}) {
  if (!value || !onFilterClick) return <span className={className}>{children}</span>;
  return (
    <span
      className={cn(className, "cursor-pointer hover:underline hover:text-primary transition-colors")}
      onClick={(e) => { e.stopPropagation(); onFilterClick(field, value); }}
      title={`Filtra: ${value}`}
    >
      {children}
    </span>
  );
}

export function ContactCard({ c, isActive, isSelected, hasBusinessCard, onSelect, onToggle, index, onFilterClick }: ContactCardProps) {
  const { open: openDrawer } = useContactDrawer();
  const cName = clean(c.company_name);
  const cContact = clean(c.name);
  const cPosition = clean(c.position);
  const cCity = clean(c.city);
  const cOrigin = clean(c.origin);
  const cCountry = clean(c.country);
  const quality = getContactQuality(c);
  const isAiProcessed = !!c.deep_search_at;
  const cCompanyAlias = clean(c.company_alias);
  const cContactAlias = clean(c.contact_alias);
  const displayCompany = cCompanyAlias || cName || "—";
  const displayContact = cContactAlias || cContact;
  const flag = countryFlag(c.country);
  const isWcaMatched = !!c.wca_partner_id;
  const cEmail = clean(c.email);

  const ed = c.enrichment_data;
  const linkedinUrl = ed?.linkedin_url;
  const companyWebsite = ed?.company_website;
  const inHolding = isInHoldingPattern(c.lead_status);

  return (
    <div
      className={cn(
        "cursor-pointer border-b border-border/30 transition-colors text-xs",
        inHolding && "border-l-2 border-l-muted-foreground/40",
        isActive
          ? isAiProcessed ? "bg-amber-500/15" : "bg-primary/15"
          : isSelected ? "bg-primary/5" : "hover:bg-muted/40"
      )}
      onClick={onSelect}
      onDoubleClick={() => openDrawer({ sourceType: "contact", sourceId: c.id })}
    >
      {/* Row 1 */}
      <div
        className={cn(CONTACT_GRID_CLASS, "px-2 py-1")}
        style={{ gridTemplateColumns: CONTACT_GRID_COLS }}
      >
        {/* Col 1: Index + Checkbox */}
        <div className="flex items-center gap-1">
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

        {/* Col 2: Flag */}
        <span className="text-sm text-center" title={cCountry || ""}>{flag}</span>

        {/* Col 3: Company + indicators */}
        <div className="flex items-center gap-1 min-w-0">
          <span className={cn(
            "font-semibold truncate",
            !cName && !cCompanyAlias ? "text-muted-foreground italic" : "text-foreground"
          )}>
            {displayCompany}
          </span>
          {isWcaMatched && (
            <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-emerald-500/20 text-emerald-400 border-0 shrink-0">WCA</Badge>
          )}
          {isAiProcessed && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
          {quality === "poor" && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
        </div>

        {/* Col 4: Contact + position */}
        <div className="flex items-center gap-1 min-w-0">
          {displayContact ? (
            <>
              <User className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate text-foreground/80">{displayContact}</span>
              {cPosition && <span className="text-[10px] text-primary font-medium truncate">· {cPosition}</span>}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>

        {/* Col 5: City */}
        <div className="min-w-0">
          {cCity ? (
            <Filterable field="city" value={cCity} onFilterClick={onFilterClick} className="truncate text-muted-foreground text-[10px]">
              {cCity}
            </Filterable>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </div>

        {/* Col 6: Country */}
        <div className="min-w-0">
          {cCountry ? (
            <Filterable field="country" value={cCountry} onFilterClick={onFilterClick} className="truncate text-muted-foreground text-[10px]">
              {cCountry}
            </Filterable>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </div>

        {/* Col 7: Origin */}
        <div className="min-w-0">
          {cOrigin ? (
            <Filterable field="origin" value={cOrigin} onFilterClick={onFilterClick}>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary font-semibold border-0 truncate max-w-full">
                {cOrigin}
              </Badge>
            </Filterable>
          ) : null}
        </div>
      </div>

      {/* Row 2 */}
      <div
        className={cn(CONTACT_GRID_CLASS, "px-2 pb-1")}
        style={{ gridTemplateColumns: CONTACT_GRID_COLS }}
      >
        {/* Col 1-2: empty spacers */}
        <div />
        <div />

        {/* Col 3: Indicators */}
        <div className="flex items-center gap-1">
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
          {hasBusinessCard && <Handshake className="w-3 h-3 text-emerald-400" />}
        </div>

        {/* Col 4: Email */}
        <div className="flex items-center gap-0.5 min-w-0">
          {cEmail ? (
            <>
              <Mail className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate text-[10px]">{cEmail}</span>
            </>
          ) : (
            <span className="text-muted-foreground/50 italic text-[10px]">no email</span>
          )}
        </div>

        {/* Col 5: Lead status */}
        <div className="min-w-0">
          {c.lead_status && c.lead_status !== "new" && (
            <Filterable field="leadStatus" value={c.lead_status} onFilterClick={onFilterClick}>
              <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {c.lead_status}
              </span>
            </Filterable>
          )}
        </div>

        {/* Col 6: Interactions */}
        <div className="flex items-center gap-0.5">
          <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0 rounded-full",
            c.interaction_count > 0 ? "bg-chart-3/20 text-chart-3" : "bg-muted text-muted-foreground"
          )}>
            <MessageCircle className="w-2.5 h-2.5" />{c.interaction_count || 0}
          </span>
        </div>

        {/* Col 7: empty */}
        <div />
      </div>
    </div>
  );
}

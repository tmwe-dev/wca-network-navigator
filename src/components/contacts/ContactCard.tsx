import { Checkbox } from "@/components/ui/checkbox";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { useContactDrawer } from "@/contexts/ContactDrawerContext";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MessageCircle, User, Sparkles, Handshake, Globe2, Linkedin, Mail, Search } from "lucide-react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { HoldingPatternBadge } from "@/components/shared/HoldingPatternBadge";
import { clean, getContactQuality, countryFlag } from "./contactHelpers";
import type { LeadStatus } from "@/hooks/useContacts";
import type { ImportedContactRecord } from "@/lib/contactActionAdapter";
import { cn } from "@/lib/utils";
import { CONTACT_GRID_COLS, CONTACT_GRID_CLASS, capitalizeLabel } from "./contactGridLayout";
import { ContactActionMenu } from "@/components/cockpit/ContactActionMenu";
import { adaptImportedContact } from "@/lib/contactActionAdapter";

interface ContactCardProps {
  c: ImportedContactRecord & Record<string, unknown>;
  isActive: boolean;
  isSelected: boolean;
  hasBusinessCard?: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onViewDetail?: () => void;
  index?: number;
  onFilterClick?: (field: string, value: string) => void;
}

function isInHoldingPattern(status: string | undefined): boolean {
  return !!status && status !== "new";
}

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

export function ContactCard({ c, isActive, isSelected, hasBusinessCard, onSelect: _onSelect, onToggle, onViewDetail, index, onFilterClick }: ContactCardProps) {
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
  const rawCompany = cCompanyAlias || cName;
  const displayCompany = rawCompany ? rawCompany.toUpperCase() : "—";
  const displayContact = cContactAlias || cContact;
  const flag = countryFlag(c.country);
  const isWcaMatched = !!c.wca_partner_id;
  const cEmail = clean(c.email);

  const ed = c.enrichment_data;
  const linkedinUrl = ed?.linkedin_url;
  const companyWebsite = ed?.company_website;
  const inHolding = isInHoldingPattern(c.lead_status);

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-filter]')) return;
    if (rawCompany && onFilterClick) {
      onFilterClick("company", rawCompany);
    }
  };

  return (
    <div
      className={cn(
        "cursor-pointer border-b border-border/50 transition-colors text-xs",
        inHolding && "border-l-2 border-l-muted-foreground/40",
        isActive
          ? isAiProcessed ? "bg-primary/15" : "bg-primary/15"
          : isSelected ? "bg-primary/5" : "hover:bg-muted/40"
      )}
      onClick={handleRowClick}
      onDoubleClick={() => openDrawer({ sourceType: "contact", sourceId: c.id })}
    >
      {/* Row 1 */}
      <div
        className={cn(CONTACT_GRID_CLASS, "px-2 pt-1.5 pb-0.5")}
        style={{ gridTemplateColumns: CONTACT_GRID_COLS }}
      >
        {/* Col 1: Index + Checkbox */}
        <div className="flex items-center gap-1" data-no-filter>
          {typeof index === "number" && (
            <span className="text-[11px] text-primary font-mono font-bold w-[20px] text-right">#{index + 1}</span>
          )}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        </div>

        {/* Col 2: Flag + country code */}
        <Filterable field="country" value={cCountry} onFilterClick={onFilterClick} className="flex flex-col items-center">
          <span className="text-lg leading-none">{flag}</span>
          {cCountry && (
            <span className="text-[8px] text-muted-foreground leading-tight mt-0.5 uppercase">
              {cCountry.slice(0, 3)}
            </span>
          )}
        </Filterable>

        {/* Col 3: Company + Position */}
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-1">
            <Filterable field="company" value={rawCompany} onFilterClick={onFilterClick}
              className={cn(
                "font-semibold truncate text-[11px]",
                !rawCompany ? "text-muted-foreground italic" : "text-foreground"
              )}>
              {displayCompany}
            </Filterable>
            {isWcaMatched && (
              <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-emerald-500/20 text-emerald-400 border-0 shrink-0">WCA</Badge>
            )}
            {(c.interaction_count ?? 0) > 0 && (
              <HoldingPatternBadge interactionCount={c.interaction_count ?? 0} lastInteractionAt={c.last_interaction_at} size="sm" />
            )}
            {isAiProcessed && <Sparkles className="w-3 h-3 text-primary shrink-0" />}
            {quality === "poor" && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
          </div>
          {cPosition && (
            <span className="text-[10px] text-primary/70 truncate block leading-tight">{capitalizeLabel(cPosition)}</span>
          )}
        </div>

        {/* Col 4: Contact name */}
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          {displayContact ? (
            <Filterable field="name" value={displayContact} onFilterClick={onFilterClick} className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate text-foreground/80">{displayContact}</span>
            </Filterable>
          ) : null}
        </div>

        {/* Col 5: City */}
        <div className="min-w-0 overflow-hidden">
          {cCity ? (
            <Filterable field="city" value={cCity} onFilterClick={onFilterClick} className="truncate text-muted-foreground text-[10px] block">
              {capitalizeLabel(cCity)}
            </Filterable>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </div>

        {/* Col 6: Origin */}
        <div className="min-w-0 overflow-hidden">
          {cOrigin ? (
            <Filterable field="origin" value={cOrigin} onFilterClick={onFilterClick}>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary font-semibold border-0 truncate max-w-full">
                {capitalizeLabel(cOrigin)}
              </Badge>
            </Filterable>
          ) : null}
        </div>

        {/* Col 7: Lens + Action Menu */}
        <div className="flex items-center gap-0.5" data-no-filter>
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail?.(); }}
            className="shrink-0 p-1 rounded hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
            title="Visualizza dettaglio"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <ContactActionMenu contact={adaptImportedContact(c)} />
        </div>
      </div>

      {/* Row 2 */}
      <div
        className={cn(CONTACT_GRID_CLASS, "px-2 pb-1.5")}
        style={{ gridTemplateColumns: CONTACT_GRID_COLS }}
      >
        {/* Col 1: empty */}
        <div />

        {/* Col 2: indicators */}
        <div className="flex items-center justify-center gap-0.5">
          {linkedinUrl && (
             <span className="p-0.5 rounded bg-muted">
               <Linkedin className="w-2.5 h-2.5 text-muted-foreground" />
             </span>
          )}
          {companyWebsite && (
            <span className="p-0.5 rounded bg-emerald-500/10">
              <Globe2 className="w-2.5 h-2.5 text-emerald-400" />
            </span>
          )}
          {hasBusinessCard && <Handshake className="w-2.5 h-2.5 text-emerald-400" />}
        </div>

        {/* Col 3: empty */}
        <div />

        {/* Col 4: Email */}
        <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
          {cEmail ? (
            <>
              <Mail className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate text-[10px]">{cEmail}</span>
            </>
          ) : (
            <span className="text-muted-foreground/40 italic text-[10px]">no email</span>
          )}
        </div>

        {/* Col 5: Lead status */}
        <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
          <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
          {c.lead_status && c.lead_status !== "new" && (
            <Filterable field="leadStatus" value={c.lead_status} onFilterClick={onFilterClick}>
              <span className="text-[9px] text-primary bg-primary/15 px-1 py-0 rounded-full font-medium truncate">
                {c.lead_status}
              </span>
            </Filterable>
          )}
        </div>

        {/* Col 6: Score + Interaction count */}
        <div className="flex items-center gap-1.5">
          <LeadScoreBadge score={c.lead_score} breakdown={c.lead_score_breakdown} />
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

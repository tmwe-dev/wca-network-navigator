import { Checkbox } from "@/components/ui/checkbox";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { useContactDrawer } from "@/contexts/ContactDrawerContext";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MessageCircle, User, Sparkles, Handshake, Globe2, Linkedin, Mail, Search } from "lucide-react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { HoldingPatternBadge } from "@/components/shared/HoldingPatternBadge";
import { clean, getContactQuality, countryFlag } from "./contactHelpers";
import type { LeadStatus } from "@/hooks/useContacts";
import { cn } from "@/lib/utils";
import { CONTACT_GRID_COLS, CONTACT_GRID_CLASS, capitalizeLabel, extractZip } from "./contactGridLayout";
import { ContactActionMenu } from "@/components/cockpit/ContactActionMenu";
import { adaptImportedContact } from "@/lib/contactActionAdapter";
import type { ImportedContactRecord } from "@/lib/contactActionAdapter";

interface ContactCardProps {
  c: ImportedContactRecord;
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
      className={cn(
        className,
        // Discoverable affordance: dotted underline always visible, solid + primary on hover.
        "cursor-pointer border-b border-dotted border-muted-foreground/40 hover:border-primary hover:text-primary transition-colors",
      )}
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
  const cZip = clean((c as unknown as { zip_code?: string | null }).zip_code) || extractZip((c as unknown as { address?: string | null }).address) || "";
  const quality = getContactQuality(c as unknown as Record<string, unknown>);
  const isAiProcessed = !!c.deep_search_at;
  const cCompanyAlias = clean(c.company_alias);
  const cContactAlias = clean(c.contact_alias);
  const rawCompany = cCompanyAlias || cName;
  const displayCompany = rawCompany ? rawCompany.toUpperCase() : "—";
  const displayContact = cContactAlias || cContact;
  const flag = countryFlag(c.country ?? null);
  const isWcaMatched = !!c.wca_partner_id;
  const cEmail = clean(c.email);

  const ed = (c.enrichment_data ?? {}) as Record<string, unknown>;
  const linkedinUrl = ed?.linkedin_url as string | undefined;
  const companyWebsite = ed?.company_website as string | undefined;
  const inHolding = isInHoldingPattern(c.lead_status ?? undefined);

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
      {/* Single dense row */}
      <div
        className={cn(CONTACT_GRID_CLASS, "px-2 py-1.5")}
        style={{ gridTemplateColumns: CONTACT_GRID_COLS }}
      >
        {/* Col 1: # + Checkbox */}
        <div className="flex items-center gap-1" data-no-filter>
          {typeof index === "number" && (
            <span className="text-[10px] text-primary/70 font-mono font-semibold w-[24px] text-right">#{index + 1}</span>
          )}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        </div>

        {/* Col 2: Località — flag + paese · città · CAP */}
        <div className="min-w-0 overflow-hidden flex items-center gap-1.5">
          <Filterable field="country" value={cCountry} onFilterClick={onFilterClick} className="text-base leading-none shrink-0">
            <span aria-hidden>{flag || "🏳"}</span>
          </Filterable>
          <div className="min-w-0 overflow-hidden leading-tight">
            <Filterable field="country" value={cCountry} onFilterClick={onFilterClick} className="block truncate text-[11px] text-foreground font-medium">
              {cCountry ? capitalizeLabel(cCountry) : <span className="text-muted-foreground/50">—</span>}
            </Filterable>
            <div className="flex items-center gap-1 min-w-0">
              {cCity ? (
                <Filterable field="city" value={cCity} onFilterClick={onFilterClick} className="truncate text-[10px] text-muted-foreground">
                  {capitalizeLabel(cCity)}
                </Filterable>
              ) : (
                <span className="text-muted-foreground/40 text-[10px]">—</span>
              )}
              {cZip && (
                <Filterable field="zip" value={cZip} onFilterClick={onFilterClick} className="text-[10px] font-mono text-muted-foreground/80 shrink-0">
                  · {cZip}
                </Filterable>
              )}
            </div>
          </div>
        </div>

        {/* Col 3: Azienda + Ruolo */}
        <div className="min-w-0 overflow-hidden leading-tight">
          <div className="flex items-center gap-1 min-w-0">
            <Filterable field="company" value={rawCompany} onFilterClick={onFilterClick}
              className={cn(
                "font-semibold truncate text-[11px]",
                !rawCompany ? "text-muted-foreground italic" : "text-foreground",
              )}>
              {displayCompany}
            </Filterable>
            {isWcaMatched && (
              <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-emerald-500/20 text-emerald-400 border-0 shrink-0">WCA</Badge>
            )}
            {isAiProcessed && <Sparkles className="w-3 h-3 text-primary shrink-0" />}
            {quality === "poor" && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
          </div>
          <div className="flex items-center gap-1 min-w-0">
            {cPosition && (
              <span className="text-[10px] text-primary/70 truncate">{capitalizeLabel(cPosition)}</span>
            )}
            {cOrigin && (
              <Filterable field="origin" value={cOrigin} onFilterClick={onFilterClick}>
                <span className="text-[9px] px-1 py-0 rounded bg-primary/15 text-primary font-semibold ml-auto shrink-0">
                  {capitalizeLabel(cOrigin)}
                </span>
              </Filterable>
            )}
          </div>
        </div>

        {/* Col 4: Contatto + Email */}
        <div className="min-w-0 overflow-hidden leading-tight">
          {displayContact ? (
            <Filterable field="name" value={displayContact} onFilterClick={onFilterClick} className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate text-[11px] text-foreground/90">{displayContact}</span>
            </Filterable>
          ) : (
            <span className="text-muted-foreground/40 text-[10px]">—</span>
          )}
          <div className="flex items-center gap-1 min-w-0">
            {cEmail ? (
              <>
                <Mail className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground truncate text-[10px]">{cEmail}</span>
              </>
            ) : (
              <span className="text-muted-foreground/40 italic text-[10px]">no email</span>
            )}
          </div>
        </div>

        {/* Col 5: Stato + Score + indicatori */}
        <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
            {c.lead_status && c.lead_status !== "new" && (
              <Filterable field="leadStatus" value={c.lead_status} onFilterClick={onFilterClick}>
                <span className="text-[9px] text-primary bg-primary/15 px-1 py-0 rounded-full font-medium truncate">
                  {c.lead_status}
                </span>
              </Filterable>
            )}
            {(c.interaction_count ?? 0) > 0 && (
              <HoldingPatternBadge interactionCount={c.interaction_count ?? 0} lastInteractionAt={c.last_interaction_at} size="sm" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <LeadScoreBadge score={c.lead_score ?? undefined} breakdown={c.lead_score_breakdown as Record<string, number> | undefined} />
            <span className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0 rounded-full",
              (c.interaction_count ?? 0) > 0 ? "bg-chart-3/20 text-chart-3" : "bg-muted text-muted-foreground",
            )}>
              <MessageCircle className="w-2.5 h-2.5" />{c.interaction_count || 0}
            </span>
            {linkedinUrl && (
              <span className="p-0.5 rounded bg-muted" title={String(linkedinUrl)}>
                <Linkedin className="w-2.5 h-2.5 text-muted-foreground" />
              </span>
            )}
            {companyWebsite && (
              <span className="p-0.5 rounded bg-emerald-500/10" title="Sito presente">
                <Globe2 className="w-2.5 h-2.5 text-emerald-400" />
              </span>
            )}
            {hasBusinessCard && <Handshake className="w-2.5 h-2.5 text-emerald-400" />}
          </div>
        </div>

        {/* Col 6: Azioni */}
        <div className="flex items-center justify-end gap-0.5" data-no-filter>
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
    </div>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { useContactDrawer } from "@/contexts/ContactDrawerContext";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MessageCircle, User, Sparkles, Handshake, Globe2, Linkedin, Mail, Phone, Search } from "lucide-react";
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
  const cPhone = clean((c as unknown as { phone?: string | null }).phone) || clean((c as unknown as { mobile?: string | null }).mobile);

  const ed = (c.enrichment_data ?? {}) as Record<string, unknown>;
  const linkedinUrl = ed?.linkedin_url as string | undefined;
  const companyWebsite = ed?.company_website as string | undefined;
  const inHolding = isInHoldingPattern(c.lead_status ?? undefined);

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-filter]')) return;
    // Click sulla riga apre il dettaglio (parità con Biglietti da visita).
    // I chip "Filterable" (azienda, paese, città, ecc.) gestiscono già il filtro
    // tramite stopPropagation, quindi non vengono intercettati qui.
    onViewDetail?.();
  };

  return (
    <div
      className={cn(
        "cursor-pointer border-b border-border/50 transition-colors",
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
        className={cn(CONTACT_GRID_CLASS, "px-3 py-2.5")}
        style={{ gridTemplateColumns: CONTACT_GRID_COLS }}
      >
        {/* Col 1: # + Checkbox */}
        <div className="flex items-center gap-1" data-no-filter>
          {typeof index === "number" && (
            <span className="text-xs text-primary/70 font-mono font-semibold w-[28px] text-right">#{index + 1}</span>
          )}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        </div>

        {/* Col 2: AZIENDA + Contatto/Ruolo (BCA-style, prima colonna larga) */}
        <div className="min-w-0 overflow-hidden leading-tight">
          <div className="flex items-center gap-1.5 min-w-0">
            {flag && (
              <Filterable field="country" value={cCountry} onFilterClick={onFilterClick} className="text-base leading-none shrink-0">
                <span aria-hidden>{flag}</span>
              </Filterable>
            )}
            <Filterable field="company" value={rawCompany} onFilterClick={onFilterClick}
              className={cn(
                "font-bold truncate text-sm",
                !rawCompany ? "text-foreground/50 italic" : "text-foreground",
              )}>
              {displayCompany}
            </Filterable>
            {isWcaMatched && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/25 text-emerald-300 border-0 shrink-0 font-semibold">WCA</Badge>
            )}
            {isAiProcessed && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />}
            {quality === "poor" && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
            {displayContact ? (
              <Filterable field="name" value={displayContact} onFilterClick={onFilterClick} className="flex items-center gap-1 min-w-0">
                <User className="w-3 h-3 text-foreground/60 shrink-0" />
                <span className="truncate text-xs text-foreground/80 font-medium">{displayContact}</span>
              </Filterable>
            ) : null}
            {cPosition && (
              <span className="text-[11px] text-foreground/60 truncate">
                {displayContact ? "· " : ""}{capitalizeLabel(cPosition)}
              </span>
            )}
          </div>
        </div>

        {/* Col 3: Località compatta (paese · città · CAP). Vuota se non si sa nulla. */}
        <div className="min-w-0 overflow-hidden leading-tight">
          {(cCountry || cCity || cZip) ? (
            <div className="flex items-center gap-1 min-w-0 flex-wrap">
              {cCountry && (
                <Filterable field="country" value={cCountry} onFilterClick={onFilterClick} className="truncate text-xs text-foreground/85 font-medium">
                  {capitalizeLabel(cCountry)}
                </Filterable>
              )}
              {cCity && (
                <>
                  {cCountry && <span className="text-foreground/40 text-xs">·</span>}
                  <Filterable field="city" value={cCity} onFilterClick={onFilterClick} className="truncate text-xs text-foreground/70">
                    {capitalizeLabel(cCity)}
                  </Filterable>
                </>
              )}
              {cZip && (
                <>
                  {(cCountry || cCity) && <span className="text-foreground/40 text-xs">·</span>}
                  <Filterable field="zip" value={cZip} onFilterClick={onFilterClick} className="text-xs font-mono text-foreground/60 shrink-0">
                    {cZip}
                  </Filterable>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* Col 4: Email + Telefono */}
        <div className="min-w-0 overflow-hidden leading-tight">
          {cEmail ? (
            <div className="flex items-center gap-1 min-w-0">
              <Mail className="w-3 h-3 text-foreground/60 shrink-0" />
              <span className="text-foreground/85 truncate text-xs">{cEmail}</span>
            </div>
          ) : null}
          {cPhone && (
            <div className="flex items-center gap-1 min-w-0 mt-0.5">
              <Phone className="w-3 h-3 text-foreground/60 shrink-0" />
              <span className="text-foreground/70 truncate text-[11px]">{cPhone}</span>
            </div>
          )}
        </div>

        {/* Col 5: Origine — colonna dedicata, sempre visibile, click-to-filter. */}
        <div className="min-w-0 overflow-hidden flex items-center" data-no-filter>
          {cOrigin ? (
            <Filterable field="origin" value={cOrigin} onFilterClick={onFilterClick}>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 font-semibold uppercase tracking-wide truncate inline-block max-w-full">
                {capitalizeLabel(cOrigin)}
              </span>
            </Filterable>
          ) : (
            <span className="text-[10px] text-foreground/30 italic">—</span>
          )}
        </div>

        {/* Col 6: Stato + Score + indicatori */}
        <div className="min-w-0 overflow-hidden flex flex-col gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
            {c.lead_status && c.lead_status !== "new" && (
              <Filterable field="leadStatus" value={c.lead_status} onFilterClick={onFilterClick}>
                <span className="text-[11px] text-primary bg-primary/20 px-1.5 py-0.5 rounded-full font-semibold truncate">
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
              "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
              (c.interaction_count ?? 0) > 0 ? "bg-chart-3/20 text-chart-3" : "bg-muted text-muted-foreground",
            )}>
              <MessageCircle className="w-3 h-3" />{c.interaction_count || 0}
            </span>
            {linkedinUrl && (
              <span className="p-1 rounded bg-sky-500/15" title="LinkedIn presente">
                <Linkedin className="w-3 h-3 text-sky-300" />
              </span>
            )}
            {companyWebsite && (
              <span className="p-1 rounded bg-emerald-500/15" title="Sito presente">
                <Globe2 className="w-3 h-3 text-emerald-300" />
              </span>
            )}
            {hasBusinessCard && (
              <span className="p-1 rounded bg-amber-500/15" title="Business Card">
                <Handshake className="w-3 h-3 text-amber-300" />
              </span>
            )}
          </div>
        </div>

        {/* Col 7: Azioni */}
        <div className="flex items-center justify-end gap-0.5" data-no-filter>
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail?.(); }}
            className="shrink-0 p-1.5 rounded hover:bg-primary/20 transition-colors text-foreground/60 hover:text-primary"
            title="Visualizza dettaglio"
          >
            <Search className="w-4 h-4" />
          </button>
          <ContactActionMenu contact={adaptImportedContact(c)} />
        </div>
      </div>
    </div>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, MessageCircle, User, Building2, MapPin, Tag, Sparkles, Handshake,
  Globe2, Linkedin, Briefcase
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger
} from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { clean, getContactQuality } from "./contactHelpers";
import type { LeadStatus } from "@/hooks/useContacts";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ContactCardProps {
  c: any;
  isActive: boolean;
  isSelected: boolean;
  hasBusinessCard?: boolean;
  onSelect: () => void;
  onToggle: () => void;
  index?: number;
}

/** Build a short enrichment summary from enrichment_data */
function getEnrichmentSummary(c: any): string[] {
  const e = c.enrichment_data;
  if (!e) return [];
  const parts: string[] = [];

  // LinkedIn headline
  const headline = e.contact_profile?.linkedin_title;
  if (headline) parts.push(`💼 ${headline}`);

  // Company specialties
  const specs = e.company_profile?.specialties;
  if (specs?.length) parts.push(`🏢 ${specs.slice(0, 3).join(", ")}`);

  // Languages
  const langs = e.contact_profile?.languages;
  if (langs?.length) parts.push(`🌍 ${langs.join(", ")}`);

  // Seniority
  const seniority = e.contact_profile?.seniority;
  if (seniority) parts.push(`📊 Seniority: ${seniority}`);

  // LinkedIn URL
  if (e.linkedin_url) parts.push(`🔗 LinkedIn trovato`);

  // Website
  if (e.company_website) parts.push(`🌐 Sito: ${e.company_website}`);

  return parts;
}

// InfoTooltip is now imported from shared component

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
  const enrichmentSummary = getEnrichmentSummary(c);

  const displayCompany = cCompanyAlias || cName || "Senza azienda";

  // Enrichment data shortcuts
  const ed = c.enrichment_data;
  const linkedinUrl = ed?.linkedin_url;
  const contactHeadline = ed?.contact_profile?.linkedin_title;
  const companyWebsite = ed?.company_website;

  return (
    <div
      className={`group relative rounded-lg border p-2 text-xs cursor-pointer transition-all ${
        isActive
          ? isAiProcessed
            ? "border-amber-400 bg-amber-500/15 shadow-md"
            : "border-primary bg-primary/15 shadow-md"
          : isSelected
          ? isAiProcessed
            ? "border-amber-400/40 bg-amber-500/10 shadow-sm"
            : "border-primary/40 bg-primary/10 shadow-sm"
          : isAiProcessed
          ? "border-amber-400/30 bg-amber-500/[0.08] hover:border-amber-400/50 hover:shadow-sm"
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
            <InfoTooltip content={
              <div>
                <p className="font-semibold">{displayCompany}</p>
                {cCompanyAlias && cName && cCompanyAlias !== cName && (
                  <p className="text-muted-foreground">Nome originale: {cName}</p>
                )}
                {cCity && <p>📍 {cCity}</p>}
                {companyWebsite && <p>🌐 {companyWebsite}</p>}
              </div>
            }>
              <span><Building2 className="w-3 h-3 text-primary shrink-0" /></span>
            </InfoTooltip>
            <span className={`font-bold truncate ${!cName && !cCompanyAlias ? "text-muted-foreground italic" : "text-foreground"}`}>
              {displayCompany}
            </span>
            {isAiProcessed && (
              <InfoTooltip content={
                <div className="space-y-1">
                  <p className="font-semibold text-amber-400">✨ Analizzato da AI</p>
                  <p>Deep Search eseguito il {c.deep_search_at ? format(new Date(c.deep_search_at), "dd MMM yyyy 'alle' HH:mm", { locale: it }) : "N/A"}</p>
                  {enrichmentSummary.length > 0 ? (
                    <div className="space-y-0.5 pt-1 border-t border-border/30">
                      {enrichmentSummary.map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Nessun dato aggiuntivo estratto</p>
                  )}
                </div>
              }>
                <span><Sparkles className="w-3 h-3 text-amber-400 shrink-0" /></span>
              </InfoTooltip>
            )}
            {hasAlias && !isAiProcessed && (
              <InfoTooltip content="Nome personalizzato (alias) impostato manualmente">
                <span><Sparkles className="w-3 h-3 text-accent-foreground shrink-0 opacity-70" /></span>
              </InfoTooltip>
            )}
            {quality === "poor" && (
              <InfoTooltip content="Dati incompleti: mancano informazioni importanti come email, telefono o nome contatto">
                <span><AlertTriangle className="w-3 h-3 text-destructive shrink-0" /></span>
              </InfoTooltip>
            )}
          </div>

          {/* Show original name if alias replaced it */}
          {cCompanyAlias && cName && cCompanyAlias !== cName && (
            <span className="text-[10px] text-muted-foreground ml-[18px] truncate block">{cName}</span>
          )}

          {/* Contact name + position */}
          {(cContact || cContactAlias) && (
            <div className="flex items-center gap-1.5 text-foreground/80">
              <InfoTooltip content={
                <div>
                  <p className="font-semibold">{cContactAlias || cContact}</p>
                  {cContactAlias && cContact && cContactAlias !== cContact && (
                    <p className="text-muted-foreground">Nome originale: {cContact}</p>
                  )}
                  {cPosition && <p>👔 {cPosition}</p>}
                  {contactHeadline && <p>💼 {contactHeadline}</p>}
                  {c.email && <p>📧 {c.email}</p>}
                  {c.phone && <p>📞 {c.phone}</p>}
                  {c.mobile && <p>📱 {c.mobile}</p>}
                </div>
              }>
                <span><User className="w-3 h-3 shrink-0 text-muted-foreground" /></span>
              </InfoTooltip>
              <span className="truncate">{cContactAlias || cContact}</span>
              {cContactAlias && cContact && cContactAlias !== cContact && (
                <span className="text-[10px] text-muted-foreground truncate">({cContact})</span>
              )}
              {cPosition && <span className="text-[10px] text-primary font-medium">• {cPosition}</span>}
            </div>
          )}

          {/* AI enrichment preview line */}
          {isAiProcessed && contactHeadline && (
            <div className="flex items-center gap-1 ml-[18px]">
              <Briefcase className="w-2.5 h-2.5 text-amber-400/70 shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">{contactHeadline}</span>
            </div>
          )}

          {/* Footer: city, origin, interactions */}
          <div className="flex items-center gap-2 pt-0.5">
            {cCity && (
              <InfoTooltip content={`Città: ${cCity}${c.country ? ` (${c.country})` : ""}`}>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate max-w-[100px]">{cCity}</span>
                </span>
              </InfoTooltip>
            )}
            {cOrigin && (
              <InfoTooltip content={`Fonte di importazione: ${cOrigin}`}>
                <span>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary font-semibold border-0">
                    <Tag className="w-2.5 h-2.5 mr-0.5" />{cOrigin}
                  </Badge>
                </span>
              </InfoTooltip>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {/* LinkedIn found indicator */}
              {linkedinUrl && (
                <InfoTooltip content={`LinkedIn trovato: ${linkedinUrl}`}>
                  <span className="p-0.5 rounded bg-[hsl(210,80%,55%)]/10">
                    <Linkedin className="w-2.5 h-2.5 text-[hsl(210,80%,55%)]" />
                  </span>
                </InfoTooltip>
              )}
              {/* Website found indicator */}
              {companyWebsite && (
                <InfoTooltip content={`Sito web: ${companyWebsite}`}>
                  <span className="p-0.5 rounded bg-emerald-500/10">
                    <Globe2 className="w-2.5 h-2.5 text-emerald-400" />
                  </span>
                </InfoTooltip>
              )}
              {hasBusinessCard && (
                <InfoTooltip content="Biglietto da visita acquisito — contatto incontrato personalmente">
                  <span>
                    <Handshake className="w-3 h-3 text-emerald-400" />
                  </span>
                </InfoTooltip>
              )}
              <InfoTooltip content={
                <div>
                  <p className="font-semibold">Stato lead</p>
                  <p>{c.lead_status === "new" ? "Nuovo — mai contattato" :
                    c.lead_status === "contacted" ? "Contattato — in attesa di risposta" :
                    c.lead_status === "in_progress" ? "In corso — dialogo attivo" :
                    c.lead_status === "negotiation" ? "Trattativa — fase avanzata" :
                    c.lead_status === "converted" ? "Cliente — conversione completata" :
                    c.lead_status === "lost" ? "Perso — opportunità chiusa" :
                    c.lead_status}</p>
                </div>
              }>
                <span>
                  <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
                </span>
              </InfoTooltip>
              <InfoTooltip content={
                c.interaction_count > 0
                  ? `${c.interaction_count} interazion${c.interaction_count === 1 ? "e" : "i"} registrat${c.interaction_count === 1 ? "a" : "e"}${c.last_interaction_at ? ` — ultima: ${format(new Date(c.last_interaction_at), "dd MMM yyyy", { locale: it })}` : ""}`
                  : "Nessuna interazione registrata"
              }>
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0 rounded-full ${
                  c.interaction_count > 0 ? "bg-chart-3/20 text-chart-3" : "bg-muted text-muted-foreground"
                }`}>
                  <MessageCircle className="w-2.5 h-2.5" />{c.interaction_count || 0}
                </span>
              </InfoTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

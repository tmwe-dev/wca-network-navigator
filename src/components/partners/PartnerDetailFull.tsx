import { useState, useCallback, Suspense, lazy } from "react";
import { getRealLogoUrl } from "@/lib/partnerUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Star, StarOff, Phone, Mail, Globe, MapPin, Calendar,
  Users, User, Sparkles, Loader2, Building2,
  ArrowUpRight, ShieldCheck, ShieldAlert, FileText,
  MessageSquare, Clock, Box, ClipboardList, Briefcase, Send,
} from "lucide-react";
import { useBlacklistForPartner } from "@/hooks/useBlacklist";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PartnerRating } from "@/components/partners/PartnerRating";
import {
  getCountryFlag, getYearsMember, formatPartnerType,
  formatServiceCategory, getServiceIconColor, resolveCountryCode,
} from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { EnrichmentCard } from "@/components/partners/EnrichmentCard";
import { SocialLinks } from "@/components/partners/SocialLinks";
import { ActivityList } from "@/components/partners/ActivityList";

import { getServiceIcon, PARTNER_TYPE_ICONS, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { getNetworkLogo } from "@/components/partners/shared/NetworkLogos";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { TrophyRow } from "@/components/partners/shared/TrophyRow";
import { getBranchCountries } from "@/lib/partnerUtils";

const PartnerMiniGlobe = lazy(() =>
  import("@/components/partners/PartnerMiniGlobe").then((m) => ({ default: m.PartnerMiniGlobe }))
);

interface PartnerDetailFullProps {
  partner: any;
  onToggleFavorite: () => void;
  onAssignActivity?: (partnerId: string) => void;
  onSendToWorkspace?: (partnerId: string) => void;
  onEmail?: (partnerId: string) => void;
}

export function PartnerDetailFull({ partner, onToggleFavorite, onAssignActivity, onSendToWorkspace, onEmail }: PartnerDetailFullProps) {
  const [deepSearching, setDeepSearching] = useState(false);
  const queryClient = useQueryClient();
  const { data: blacklistEntries = [] } = useBlacklistForPartner(partner.id);
  const isBlacklisted = blacklistEntries.length > 0;

  const handleDeepSearch = useCallback(async () => {
    setDeepSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("deep-search-partner", {
        body: { partnerId: partner.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Deep Search completata: ${data.socialLinksFound} social trovati${data.logoFound ? ", logo trovato" : ""}`);
        queryClient.invalidateQueries({ queryKey: ["partner", partner.id] });
        queryClient.invalidateQueries({ queryKey: ["social-links", partner.id] });
      } else {
        toast.error(data?.error || "Errore nella Deep Search");
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore nella Deep Search");
    } finally {
      setDeepSearching(false);
    }
  }, [partner.id, queryClient]);

  const hasBranches = Array.isArray(partner.branch_cities) && partner.branch_cities.length > 0;
  const branchCountries = getBranchCountries(partner);
  const years = getYearsMember(partner.member_since);
  const services = partner.partner_services || [];
  const transportServices = services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category));
  const specialtyServices = services.filter((s: any) => SPECIALTY_SERVICES.includes(s.service_category));
  const PartnerTypeIcon = PARTNER_TYPE_ICONS[partner.partner_type || ""] || Box;
  const enrichment = partner.enrichment_data as any;
  const foundedYear = partner.member_since ? new Date(partner.member_since).getFullYear() : null;

  return (
    <div className="p-6 space-y-4">
      {/* Blacklist Warning */}
      {isBlacklisted && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">⚠️ BLACKLIST WCA</p>
            <p className="text-sm text-destructive/80 mt-0.5">
              Questa azienda risulta nella blacklist WCA con {blacklistEntries.length} segnalazione/i.
              {blacklistEntries[0]?.total_owed_amount && (
                <> Importo totale dovuto: <strong>${Number(blacklistEntries[0].total_owed_amount).toLocaleString()}</strong></>
              )}
              {blacklistEntries[0]?.status && <> — Status: <strong>{blacklistEntries[0].status}</strong></>}
            </p>
            {blacklistEntries[0]?.claims && (
              <details className="mt-2">
                <summary className="text-xs font-medium cursor-pointer text-destructive/70">Dettaglio claims</summary>
                <pre className="text-[10px] text-destructive/60 mt-1 whitespace-pre-wrap">{blacklistEntries[0].claims}</pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* ═══ NETWORK BAR (top) ═══ */}
      {partner.partner_networks?.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {partner.partner_networks.map((n: any) => {
            const logo = getNetworkLogo(n.network_name);
            return (
              <Tooltip key={n.id}>
                <TooltipTrigger>
                  <div className="shrink-0 flex items-center gap-2 bg-card/80 border border-primary/10 rounded-xl px-3 py-1.5 hover:shadow-md transition-shadow">
                    {logo ? (
                      <img src={logo} alt={n.network_name} className="h-7 w-auto object-contain" />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">{n.network_name}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {n.network_name}
                  {n.expires && <> — Scade {format(new Date(n.expires), "MMM yyyy")}</>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* ═══ HEADER CARD (clean) ═══ */}
      <div className="bg-gradient-to-br from-primary/5 via-card to-accent/10 backdrop-blur-sm border border-primary/10 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="shrink-0">
              {getRealLogoUrl(partner.logo_url) ? (
                <img
                  src={getRealLogoUrl(partner.logo_url)!}
                  alt={partner.company_name}
                  className="w-14 h-14 rounded-xl object-contain bg-muted/50 border border-primary/10"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-muted/50 border border-primary/10 flex items-center justify-center">
                  <span className="text-3xl">{getCountryFlag(partner.country_code)}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground truncate">{partner.company_name}</h2>
                {partner.wca_id && (
                  <span className="text-xs text-muted-foreground shrink-0">WCA #{partner.wca_id}</span>
                )}
              </div>
              <p className="text-foreground font-semibold mt-0.5">{partner.city}</p>
              <p className="text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-2xl leading-none">{getCountryFlag(partner.country_code)}</span>
                <span>{partner.country_name}</span>
                <span className="text-border">·</span>
                <PartnerTypeIcon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-sm">{formatPartnerType(partner.partner_type)}</span>
                {partner.office_type && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border">
                    {partner.office_type === "head_office" ? "HQ" : "Branch"}
                  </span>
                )}
              </p>
              {/* Rating + Trophy + Founded */}
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} size="w-4 h-4" />}
                {years > 0 && (
                  <Tooltip>
                    <TooltipTrigger><div><TrophyRow years={years} /></div></TooltipTrigger>
                    <TooltipContent>{years} anni membro WCA</TooltipContent>
                  </Tooltip>
                )}
                {foundedYear && (
                  <span className="text-xs bg-secondary/80 text-secondary-foreground border rounded-md px-2 py-0.5">
                    Est. {foundedYear}
                  </span>
                )}
              </div>
              {/* Quick contact info */}
              <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                {partner.phone && (
                  <a href={`tel:${partner.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Phone className="w-3.5 h-3.5" strokeWidth={1.5} /> {partner.phone}
                  </a>
                )}
                {partner.email && (
                  <a href={`mailto:${partner.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Mail className="w-3.5 h-3.5" strokeWidth={1.5} /> {partner.email}
                  </a>
                )}
                {partner.website && (
                  <a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}
                    target="_blank" rel="noopener"
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Globe className="w-3.5 h-3.5" strokeWidth={1.5} /> {partner.website}
                  </a>
                )}
              </div>
              {/* Company-level social */}
              <div className="mt-1.5">
                <SocialLinks partnerId={partner.id} compact />
              </div>
            </div>
          </div>
          {/* Favorite */}
          <div className="flex gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onToggleFavorite}
                  className={cn("rounded-xl transition-all", partner.is_favorite && "shadow-sm shadow-amber-400/30")}>
                  {partner.is_favorite ? <Star className="w-5 h-5 fill-amber-400 text-amber-400" /> : <StarOff className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{partner.is_favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ═══ ACTION BAR ═══ */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/[0.06] backdrop-blur-xl border border-violet-500/15">
        {onAssignActivity && (
          <Button size="sm" variant="ghost" onClick={() => onAssignActivity(partner.id)}
            className="h-7 px-2.5 text-xs gap-1.5 text-violet-300 hover:bg-violet-500/15 hover:text-violet-100">
            <ClipboardList className="w-3.5 h-3.5" /> Attività
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={handleDeepSearch} disabled={deepSearching}
          className="h-7 px-2.5 text-xs gap-1.5 text-violet-300 hover:bg-violet-500/15 hover:text-violet-100">
          {deepSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Deep Search
        </Button>
        {onSendToWorkspace && (
          <Button size="sm" variant="ghost" onClick={() => onSendToWorkspace(partner.id)}
            className="h-7 px-2.5 text-xs gap-1.5 text-violet-300 hover:bg-violet-500/15 hover:text-violet-100">
            <Briefcase className="w-3.5 h-3.5" /> Workspace
          </Button>
        )}
        {onEmail && (
          <Button size="sm" variant="ghost" onClick={() => onEmail(partner.id)}
            className="h-7 px-2.5 text-xs gap-1.5 text-violet-300 hover:bg-violet-500/15 hover:text-violet-100">
            <Send className="w-3.5 h-3.5" /> Email
          </Button>
        )}
      </div>

      {/* ═══ PROFILE (right after action bar) ═══ */}
      {partner.profile_description && (
        <div className="bg-card/80 backdrop-blur-sm border border-primary/5 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium flex items-center gap-2">
            <FileText className="w-4 h-4" strokeWidth={1.5} /> Profilo Aziendale
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{partner.profile_description}</p>
        </div>
      )}

      {/* ═══ TWO COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* ─── LEFT COLUMN ─── */}
        <div className="space-y-4">
          {/* Transport Services - horizontal with outline icons */}
          {transportServices.length > 0 && (
            <div className="bg-gradient-to-br from-sky-500/5 via-card to-blue-500/5 border border-sky-500/10 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Servizi di Trasporto</p>
              <div className="flex flex-wrap gap-2">
                {transportServices.map((s: any, i: number) => {
                  const Icon = getServiceIcon(s.service_category);
                  return (
                    <div key={i} className="flex flex-col items-center gap-1.5 bg-card/80 border border-sky-500/10 rounded-xl px-3 py-2.5 min-w-[70px]">
                      <Icon className="w-6 h-6 text-sky-500" strokeWidth={1.5} />
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">{formatServiceCategory(s.service_category)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specialty Services - horizontal with outline icons */}
          {specialtyServices.length > 0 && (
            <div className="bg-gradient-to-br from-violet-500/5 via-card to-pink-500/5 border border-violet-500/10 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Specialità</p>
              <div className="flex flex-wrap gap-2">
                {specialtyServices.map((s: any, i: number) => {
                  const Icon = getServiceIcon(s.service_category);
                  return (
                    <div key={i} className="flex flex-col items-center gap-1.5 bg-card/80 border border-violet-500/10 rounded-xl px-3 py-2.5 min-w-[70px]">
                      <Icon className="w-6 h-6 text-violet-400" strokeWidth={1.5} />
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">{formatServiceCategory(s.service_category)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Enrichment */}
          <EnrichmentCard partner={partner} />

          {/* Activities */}
          <ActivityList partnerId={partner.id} />

          {/* Timeline */}
          <div className="bg-card/80 border border-primary/5 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
              Timeline ({partner.interactions?.length || 0})
            </p>
            {!partner.interactions?.length ? (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nessuna interazione</p>
              </div>
            ) : (
              <div className="space-y-3">
                {partner.interactions.map((interaction: any) => (
                  <div key={interaction.id} className="flex gap-3 p-3 rounded-xl bg-muted/50 border hover:shadow-sm transition-shadow">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 bg-gradient-to-br from-primary/20 to-accent/20 text-foreground border border-primary/10">
                      {interaction.interaction_type?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-foreground">{interaction.subject}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(interaction.interaction_date), "d MMM yyyy", { locale: it })}
                        </span>
                      </div>
                      {interaction.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{interaction.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminders */}
          {partner.reminders?.length > 0 && (
            <div className="bg-card/80 border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Promemoria</p>
              <div className="space-y-2">
                {partner.reminders.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border hover:shadow-sm transition-shadow">
                    <div>
                      <p className="font-medium text-sm text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Scadenza: {format(new Date(r.due_date), "d MMM yyyy", { locale: it })}
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      r.status === "completed" ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/10 text-primary"
                    )}>
                      {r.status === "completed" ? "Completato" : "In attesa"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="space-y-4">
          {/* Company Contacts */}
          <div className="bg-card/80 border border-sky-500/10 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-400" strokeWidth={1.5} /> Contatti Azienda
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Phone className={cn("w-4 h-4", partner.phone ? "text-sky-500" : "text-muted-foreground/30")} strokeWidth={1.5} />
                {partner.phone ? (
                  <a href={`tel:${partner.phone}`} className="text-foreground hover:text-primary">{partner.phone}</a>
                ) : (
                  <span className="text-muted-foreground/40 italic text-xs">N/A</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className={cn("w-4 h-4", partner.email ? "text-sky-500" : "text-muted-foreground/30")} strokeWidth={1.5} />
                {partner.email ? (
                  <a href={`mailto:${partner.email}`} className="text-foreground hover:text-primary">{partner.email}</a>
                ) : (
                  <span className="text-muted-foreground/40 italic text-xs">N/A</span>
                )}
              </div>
              {partner.fax && (
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  <span>{partner.fax}</span>
                </div>
              )}
              {partner.address && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-rose-400 mt-0.5" strokeWidth={1.5} />
                  <span>{partner.address}</span>
                </div>
              )}
              {partner.member_since && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-primary" strokeWidth={1.5} />
                  <span>Membro dal {format(new Date(partner.member_since), "MMMM yyyy", { locale: it })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Office Contacts */}
          {partner.partner_contacts?.length > 0 && (
            <div className="bg-card/80 border border-emerald-500/10 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" strokeWidth={1.5} /> Contatti Ufficio ({partner.partner_contacts.length})
              </p>
              <div className="space-y-2">
                {partner.partner_contacts.map((c: any) => (
                  <div key={c.id} className="bg-muted/30 border rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <p className="font-medium text-sm">{c.name}</p>
                      {c.is_primary && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Primary</span>
                      )}
                    </div>
                    {c.title && <p className="text-xs text-muted-foreground ml-5">{c.title}</p>}
                    <div className="flex items-center gap-3 text-xs ml-5 flex-wrap">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Mail className="w-3 h-3 text-sky-500" strokeWidth={1.5} /> {c.email}
                        </a>
                      )}
                      {c.direct_phone && (
                        <a href={`tel:${c.direct_phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Phone className="w-3 h-3 text-sky-500" strokeWidth={1.5} /> {c.direct_phone}
                        </a>
                      )}
                      {c.mobile && (
                        <a href={`tel:${c.mobile}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Phone className="w-3 h-3 text-sky-500" strokeWidth={1.5} /> {c.mobile}
                        </a>
                      )}
                      {(() => {
                        const waNumber = c.mobile || c.direct_phone;
                        if (!waNumber) return null;
                        const cleaned = waNumber.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
                        return (
                          <a href={`https://wa.me/${cleaned}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20"
                            title="WhatsApp">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        );
                      })()}
                    </div>
                    <div className="ml-5">
                      <SocialLinks partnerId={partner.id} contactId={c.id} compact />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Branch Countries */}
          {branchCountries.length > 0 && (
            <div className="bg-card/80 border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
                Paesi Collegati ({branchCountries.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {branchCountries.map(({ code, name }) => (
                  <span key={code} className="flex items-center gap-1.5 text-sm bg-muted/50 border rounded-lg py-1.5 px-2.5">
                    <span className="text-lg">{getCountryFlag(code)}</span> {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Markets */}
          {enrichment?.key_markets && Array.isArray(enrichment.key_markets) && enrichment.key_markets.length > 0 && (
            <div className="bg-card/80 border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Mercati Principali</p>
              <div className="flex flex-wrap gap-2">
                {enrichment.key_markets.map((market: string, i: number) => {
                  const code = resolveCountryCode(market);
                  return (
                    <span key={i} className="flex items-center gap-1.5 text-sm bg-muted/50 border rounded-lg py-1.5 px-2.5">
                      <span className="text-lg">{code ? getCountryFlag(code) : "🌍"}</span> {market}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key Routes */}
          {enrichment?.key_routes && Array.isArray(enrichment.key_routes) && enrichment.key_routes.length > 0 && (
            <div className="bg-card/80 border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Routing Principali</p>
              <div className="space-y-2">
                {enrichment.key_routes.map((route: any, i: number) => {
                  const fromCode = resolveCountryCode(route.from || route.origin || "");
                  const toCode = resolveCountryCode(route.to || route.destination || "");
                  return (
                    <div key={i} className="flex items-center justify-center gap-3 bg-muted/50 border rounded-xl py-2.5 px-3">
                      <span className="text-xl">{fromCode ? getCountryFlag(fromCode) : "🌍"}</span>
                      <ArrowUpRight className="w-4 h-4 text-sky-500 rotate-45 shrink-0" />
                      <span className="text-xl">{toCode ? getCountryFlag(toCode) : "🌍"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mini Globe */}
          {hasBranches && (
            <div className="bg-card/80 border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Mappa Filiali</p>
              <Suspense fallback={<Skeleton className="w-full h-[200px] rounded-xl" />}>
                <PartnerMiniGlobe
                  partnerCountryCode={partner.country_code}
                  partnerCity={partner.city}
                  branchCities={partner.branch_cities}
                />
              </Suspense>
            </div>
          )}

          {/* Certifications */}
          {partner.partner_certifications?.length > 0 && (
            <div className="bg-card/80 border border-primary/5 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Certificazioni</p>
              <div className="flex flex-wrap gap-2">
                {partner.partner_certifications.map((c: any, i: number) => (
                  <span key={i} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                    {c.certification}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

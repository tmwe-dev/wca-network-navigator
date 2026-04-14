import { useState, useCallback } from "react";
import type { PartnerViewModel } from "@/types/partner-views";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Star, Phone, Mail, Globe, MapPin, Calendar,
  ChevronDown, User, Loader2, Search,
  Trophy, FileText, ExternalLink, ArrowLeft, Send,
} from "lucide-react";
import { useBlacklistForPartner } from "@/hooks/useBlacklist";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PartnerRating } from "@/components/partners/PartnerRating";
import {
  getCountryFlag, getYearsMember, formatServiceCategory,
  getServiceIconColor,
} from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { EnrichmentCard } from "@/components/partners/EnrichmentCard";
import { SocialLinks } from "@/components/partners/SocialLinks";
import { ActivityList } from "@/components/partners/ActivityList";
import { t } from "@/components/download/theme";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";

import { getServiceIcon, TRANSPORT_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { getBranchCountries } from "@/lib/partnerUtils";
import { PartnerContactActionMenu } from "@/components/partners/PartnerContactActionMenu";
import { insertActivity } from "@/data/activities";

interface ServiceItem { service_category: string }
interface NetworkItem { id: string; network_name: string; expires: string | null }
interface ContactItem { id: string; name: string; title: string | null; email: string | null; direct_phone: string | null; mobile: string | null; is_primary: boolean | null; contact_alias: string | null }

interface PartnerDetailCompactProps {
  partner: PartnerViewModel;
  onBack: () => void;
  onToggleFavorite: () => void;
  isDark: boolean;
}

export function PartnerDetailCompact({ partner, onBack, onToggleFavorite, isDark }: PartnerDetailCompactProps) {
  const th = t(isDark);
  const navigate = useAppNavigate();
  const queryClient = useQueryClient();
  const [deepSearching, setDeepSearching] = useState(false);
  const [waSending, setWaSending] = useState<string | null>(null);
  const { sendWhatsApp, isAvailable: waAvailable } = useWhatsAppExtensionBridge();
  const { data: blacklistEntries = [] } = useBlacklistForPartner(partner.id);
  const isBlacklisted = blacklistEntries.length > 0;
  const years = getYearsMember(partner.member_since ?? null);
  const _enrichment = partner.enrichment_data as Record<string, unknown>;
  const _branchCountries = getBranchCountries(partner);

  const handleDeepSearch = useCallback(async () => {
    setDeepSearching(true);
    try {
      const data = await invokeEdge<Record<string, unknown>>("ai-utility", { body: { action: "deep_search", partnerId: partner.id }, context: "PartnerDetailCompact.deep_search_partner" });
      if (data?.success) {
         toast.success(`Deep Search completata: ${data.socialLinksFound} social trovati`);
        queryClient.invalidateQueries({ queryKey: ["partner", partner.id] });
      } else { toast.error(String(data?.error || "Errore")); }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Errore"); }
    finally { setDeepSearching(false); }
  }, [partner.id, queryClient]);

  const contacts = partner.partner_contacts || [];
  const services = partner.partner_services || [];
  const networks = partner.partner_networks || [];

  // ── Email: navigate to composer with contact pre-filled ──
  const handleSendEmail = useCallback((contact: { id?: string; email?: string; name?: string }) => {
    navigate("/email-composer", {
      state: {
        partnerIds: [partner.id],
        prefilledRecipient: {
          email: contact.email,
          name: contact.name,
          company: partner.company_name,
          partnerId: partner.id,
          contactId: contact.id,
        },
      },
    });
  }, [partner, navigate]);

  // ── WhatsApp: send via extension bridge ──
  const handleSendWhatsApp = useCallback(async (contact: Record<string, any>) => {
    const phone = contact.mobile || contact.direct_phone;
    if (!phone) return;
    if (!waAvailable) {
      toast.error("Estensione WhatsApp non connessa. Apri WhatsApp Web e ricarica.");
      return;
    }
    setWaSending(contact.id);
    try {
      // Clean phone number
      const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
      const result = await sendWhatsApp(cleanPhone, "");
      if (result?.success) {
        toast.success(`Chat WhatsApp aperta con ${contact.name}`);
        // Create activity for holding pattern
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await insertActivity({
            activity_type: "whatsapp_message" as "whatsapp_message",
            title: `WhatsApp a ${contact.name} (${partner.company_name})`,
            source_type: "partner",
            source_id: partner.id,
            partner_id: partner.id,
            selected_contact_id: contact.id,
            status: "completed" as "completed",
            user_id: user.id,
          });
        }
      } else {
        toast.error(`Contatto non trovato su WhatsApp: ${result?.error || "Errore sconosciuto"}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore invio WhatsApp");
    } finally {
      setWaSending(null);
    }
  }, [partner, waAvailable, sendWhatsApp]);
   const _transportServices = services.filter((s: { service_category: string }) => TRANSPORT_SERVICES.includes(s.service_category));
   const _specialtyServices = services.filter((s: { service_category: string }) => !TRANSPORT_SERVICES.includes(s.service_category));

  return (
    <div className="p-4 space-y-4">
      {/* Header: Company name full width */}
      <div className="space-y-3">
        <h2 className={`text-lg font-bold leading-tight ${th.h2}`}>
          {partner.company_name}
          {partner.company_alias && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-normal align-middle">
              {partner.company_alias}
            </span>
          )}
        </h2>

        {/* Location line */}
        <p className={`text-sm ${th.sub}`}>
          {getCountryFlag(partner.country_code)} {partner.city}{partner.country_name ? `, ${partner.country_name}` : ""}
        </p>

        {/* Action buttons row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onBack} className="h-7 text-xs gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Indietro
          </Button>
          <Button size="sm" variant="outline" onClick={onToggleFavorite} className="h-7 text-xs">
            <Star className={cn("w-3.5 h-3.5", partner.is_favorite && "fill-primary text-primary")} />
          </Button>
          <Button size="sm" variant="outline" onClick={handleDeepSearch} disabled={deepSearching} className="h-7 text-xs gap-1">
            {deepSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Deep
          </Button>
          {partner.website && (
            <Button size="sm" variant="outline" asChild className="h-7 text-xs">
              <a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noopener">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
          {isBlacklisted && <Badge variant="destructive" className="text-xs">Blacklist</Badge>}
        </div>

        {/* Membership KPIs row */}
        <div className="flex items-center gap-3 flex-wrap">
          {(partner.rating ?? 0) > 0 && <PartnerRating rating={Number(partner.rating)} ratingDetails={partner.rating_details as Parameters<typeof PartnerRating>[0]["ratingDetails"]} />}
           {years > 0 && (
             <div className="flex items-center gap-1">
               <Trophy className="w-4 h-4 text-primary fill-primary" />
               <span className="text-sm font-bold text-primary">{years} anni WCA</span>
            </div>
          )}
          {partner.membership_expires && (
            <span className={cn("text-xs", new Date(partner.membership_expires) < new Date() ? "text-red-500" : th.dim)}>
              Exp {format(new Date(partner.membership_expires), "MM/yy")}
            </span>
          )}
        </div>
      </div>

      {/* Enrichment — top priority */}
      <EnrichmentCard partner={partner as never} />

      {/* Contacts */}
      {contacts.length > 0 && (
        <div className="space-y-2">
          <p className={`text-xs uppercase tracking-wider font-medium ${th.dim}`}>Contatti ({contacts.length})</p>
          {contacts.map((c: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
            <div key={c.id} className={`p-2.5 rounded-lg border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/60 border-slate-200/60"}`}>
              <div className="flex items-center gap-2">
                <User className={`w-4 h-4 ${th.dim}`} />
                <span className={`text-sm font-medium ${th.h2}`}>{c.name}</span>
                 {c.contact_alias && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">{c.contact_alias}</span>}
                 {c.is_primary && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Primary</span>}
                <div className="ml-auto">
                  <PartnerContactActionMenu
                    contact={c}
                    partner={{ id: partner.id, company_name: partner.company_name }}
                    onSendEmail={handleSendEmail}
                    onSendWhatsApp={handleSendWhatsApp}
                    waAvailable={waAvailable}
                  />
                </div>
              </div>
              {c.title && <p className={`text-xs ml-6 ${th.dim}`}>{c.title}</p>}
              <div className="space-y-0.5 ml-6 mt-1">
                {c.email && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSendEmail(c); }}
                     className="flex items-center gap-1.5 text-xs group w-full text-left hover:bg-primary/10 rounded px-1 -mx-1 py-0.5 transition-colors"
                   >
                     <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                     <span className="text-primary font-medium group-hover:underline">{c.email}</span>
                     <Send className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
                  </button>
                )}
                {c.direct_phone && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <a href={`tel:${c.direct_phone}`} className="text-emerald-400 hover:underline font-medium">{c.direct_phone}</a>
                  </div>
                )}
                {c.mobile && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                    <a href={`tel:${c.mobile}`} className={`hover:underline ${th.body}`}>{c.mobile}</a>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(c); }}
                      disabled={waSending === c.id}
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-[#25D366] hover:bg-[#25D366]/15 transition-colors disabled:opacity-50"
                      title={waAvailable ? "Invia WhatsApp" : "WhatsApp non connesso"}
                    >
                      {waSending === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      )}
                    </button>
                    {!waAvailable && (
                      <span className="text-[9px] text-muted-foreground/50">offline</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Social */}
      <SocialLinks partnerId={partner.id} />

      {/* Company info — compact inline */}
      <div className="space-y-1.5">
        <p className={`text-xs uppercase tracking-wider font-medium ${th.dim}`}>Info</p>
         {partner.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-primary" /><span className={th.body}>{partner.phone}</span></div>}
         {partner.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-3.5 h-3.5 text-primary" /><a href={`mailto:${partner.email}`} className={`hover:underline ${th.body}`}>{partner.email}</a></div>}
         {partner.website && <div className="flex items-center gap-2 text-sm"><Globe className="w-3.5 h-3.5 text-primary" /><a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noopener" className={`hover:underline ${th.body}`}>{partner.website}</a></div>}
         {partner.address && <div className="flex items-center gap-2 text-sm"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /><span className={th.body}>{partner.address}</span></div>}
         {partner.member_since && <div className="flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-primary" /><span className={th.body}>Membro dal {format(new Date(partner.member_since), "MMMM yyyy", { locale: it })}</span></div>}
      </div>

      {/* Services — inline icons */}
      {services.length > 0 && (
        <div>
          <p className={`text-xs uppercase tracking-wider font-medium mb-1.5 ${th.dim}`}>Servizi</p>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s: Record<string, any>, i: number) => {
              const Icon = getServiceIcon(s.service_category);
              return (
                <Tooltip key={i}>
                  <TooltipTrigger>
                    <Icon className={cn("w-5 h-5", getServiceIconColor(s.service_category))} />
                  </TooltipTrigger>
                  <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* Networks — inline badges */}
      {networks.length > 0 && (
        <div>
          <p className={`text-xs uppercase tracking-wider font-medium mb-1.5 ${th.dim}`}>Network</p>
          <div className="flex flex-wrap gap-1.5">
            {networks.map((n: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
              <span key={n.id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                {n.network_name}
                {n.expires && <span className="ml-1 opacity-60">Exp {format(new Date(n.expires), "MM/yy")}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      <ActivityList partnerId={partner.id} />

      {/* Profile */}
      {partner.profile_description && (
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className={`flex items-center gap-2 py-2 cursor-pointer ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-white/50"} rounded-lg px-2 -mx-2 transition-colors`}>
              <FileText className={`w-4 h-4 ${th.dim}`} />
              <span className={`text-xs font-medium ${th.body}`}>Profilo Aziendale</span>
              <ChevronDown className={`w-3.5 h-3.5 ml-auto ${th.dim}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-sm leading-relaxed whitespace-pre-line mt-1 text-foreground/80">
              {partner.profile_description}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

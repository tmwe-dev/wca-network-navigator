import { useState, useCallback } from "react";
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
  Trophy, FileText, ExternalLink, ArrowLeft,
} from "lucide-react";
import { useBlacklistForPartner } from "@/hooks/useBlacklist";
import { supabase } from "@/integrations/supabase/client";
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

import { getServiceIcon, TRANSPORT_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { getBranchCountries } from "@/lib/partnerUtils";

interface PartnerDetailCompactProps {
  partner: any;
  onBack: () => void;
  onToggleFavorite: () => void;
  isDark: boolean;
}

export function PartnerDetailCompact({ partner, onBack, onToggleFavorite, isDark }: PartnerDetailCompactProps) {
  const th = t(isDark);
  const queryClient = useQueryClient();
  const [deepSearching, setDeepSearching] = useState(false);
  const { data: blacklistEntries = [] } = useBlacklistForPartner(partner.id);
  const isBlacklisted = blacklistEntries.length > 0;
  const years = getYearsMember(partner.member_since);
  const enrichment = partner.enrichment_data as any;
  const branchCountries = getBranchCountries(partner);

  const handleDeepSearch = useCallback(async () => {
    setDeepSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("deep-search-partner", { body: { partnerId: partner.id } });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Deep Search completata: ${data.socialLinksFound} social trovati`);
        queryClient.invalidateQueries({ queryKey: ["partner", partner.id] });
      } else { toast.error(data?.error || "Errore"); }
    } catch (e: any) { toast.error(e?.message || "Errore"); }
    finally { setDeepSearching(false); }
  }, [partner.id, queryClient]);

  const contacts = partner.partner_contacts || [];
  const services = partner.partner_services || [];
  const networks = partner.partner_networks || [];
  const transportServices = services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category));
  const specialtyServices = services.filter((s: any) => !TRANSPORT_SERVICES.includes(s.service_category));

  return (
    <div className="p-4 space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={`p-1.5 rounded-lg transition-colors ${th.back}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={`text-lg font-bold truncate ${th.h2}`}>
            {partner.company_name}
            {partner.company_alias && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 font-normal align-middle">{partner.company_alias}</span>}
          </h2>
          <p className={`text-sm ${th.sub}`}>
            {getCountryFlag(partner.country_code)} {partner.city}, {partner.country_name}
          </p>
        </div>
        {isBlacklisted && <Badge variant="destructive" className="text-xs">Blacklist</Badge>}
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={onToggleFavorite} className="h-7 text-xs">
            <Star className={cn("w-3.5 h-3.5", partner.is_favorite && "fill-amber-400 text-amber-400")} />
          </Button>
          <Button size="sm" variant="outline" onClick={handleDeepSearch} disabled={deepSearching} className="h-7 text-xs">
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
        </div>
      </div>

      {/* Rating + KPIs */}
      <div className="flex items-center gap-4 flex-wrap">
        {partner.rating > 0 && <PartnerRating rating={Number(partner.rating)} ratingDetails={partner.rating_details as any} />}
        {years > 0 && (
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className={`text-sm font-bold text-amber-500`}>{years} anni WCA</span>
          </div>
        )}
        {partner.membership_expires && (
          <span className={cn("text-xs", new Date(partner.membership_expires) < new Date() ? "text-red-500" : th.dim)}>
            Exp {format(new Date(partner.membership_expires), "MM/yy")}
          </span>
        )}
      </div>

      {/* Contacts */}
      {contacts.length > 0 && (
        <div className={`rounded-xl border p-3 space-y-2 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
          <p className={`text-xs uppercase tracking-wider font-medium ${th.dim}`}>Contatti ({contacts.length})</p>
          {contacts.map((c: any) => (
            <div key={c.id} className={`p-2.5 rounded-lg border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/60 border-slate-200/60"}`}>
              <div className="flex items-center gap-2">
                <User className={`w-4 h-4 ${th.dim}`} />
                <span className={`text-sm font-medium ${th.h2}`}>{c.name}</span>
                {c.contact_alias && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{c.contact_alias}</span>}
                {c.is_primary && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20">Primary</span>}
                <div className="flex items-center gap-1 ml-auto">
                  <Mail className={cn("w-3.5 h-3.5", c.email ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                  <Phone className={cn("w-3.5 h-3.5", (c.direct_phone || c.mobile) ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                </div>
              </div>
              {c.title && <p className={`text-xs ml-6 ${th.dim}`}>{c.title}</p>}
              <div className="flex items-center gap-3 text-xs ml-6 mt-1 flex-wrap">
                {c.email && <a href={`mailto:${c.email}`} className={`hover:underline ${th.body}`}>{c.email}</a>}
                {c.direct_phone && <a href={`tel:${c.direct_phone}`} className={`hover:underline ${th.body}`}>{c.direct_phone}</a>}
                {c.mobile && <a href={`tel:${c.mobile}`} className={`hover:underline ${th.body}`}>{c.mobile}</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className={`rounded-xl border p-3 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
          <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${th.dim}`}>Servizi</p>
          <div className="flex flex-wrap gap-2">
            {services.map((s: any, i: number) => {
              const Icon = getServiceIcon(s.service_category);
              return (
                <Tooltip key={i}>
                  <TooltipTrigger>
                    <div className={`p-2 rounded-lg border ${isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white/60 border-slate-200"}`}>
                      <Icon className={cn("w-5 h-5", getServiceIconColor(s.service_category))} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* Company info */}
      <div className={`rounded-xl border p-3 space-y-2 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
        <p className={`text-xs uppercase tracking-wider font-medium ${th.dim}`}>Info Azienda</p>
        {partner.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-sky-500" /><span className={th.body}>{partner.phone}</span></div>}
        {partner.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-sky-500" /><a href={`mailto:${partner.email}`} className={`hover:underline ${th.body}`}>{partner.email}</a></div>}
        {partner.website && <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-sky-400" /><a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noopener" className={`hover:underline ${th.body}`}>{partner.website}</a></div>}
        {partner.address && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-rose-400" /><span className={th.body}>{partner.address}</span></div>}
        {partner.member_since && <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-sky-500" /><span className={th.body}>Membro dal {format(new Date(partner.member_since), "MMMM yyyy", { locale: it })}</span></div>}
      </div>

      {/* Networks */}
      {networks.length > 0 && (
        <div className={`rounded-xl border p-3 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
          <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${th.dim}`}>Network</p>
          <div className="space-y-1.5">
            {networks.map((n: any) => (
              <div key={n.id} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? "bg-white/[0.03]" : "bg-white/60"}`}>
                <Globe className={`w-4 h-4 ${th.dim}`} />
                <span className={`text-sm ${th.body}`}>{n.network_name}</span>
                {n.expires && <span className={`text-xs ml-auto ${th.dim}`}>Exp {format(new Date(n.expires), "MM/yy")}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social */}
      <SocialLinks partnerId={partner.id} />

      {/* Enrichment */}
      <EnrichmentCard partner={partner} />

      {/* Activities */}
      <ActivityList partnerId={partner.id} />

      {/* Profile */}
      {partner.profile_description && (
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${isDark ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]" : "bg-white/50 border-white/80 hover:bg-white/70"}`}>
              <FileText className={`w-4 h-4 ${th.dim}`} />
              <span className={`text-xs font-medium ${th.body}`}>Profilo Aziendale</span>
              <ChevronDown className={`w-3.5 h-3.5 ml-auto ${th.dim}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className={`text-sm leading-relaxed whitespace-pre-line mt-2 p-3 rounded-xl ${isDark ? "bg-white/[0.02] text-slate-300" : "bg-white/40 text-slate-600"}`}>
              {partner.profile_description}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

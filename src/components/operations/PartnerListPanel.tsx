import { useState, useMemo, useCallback } from "react";
import { SendEmailDialog } from "@/components/operations/SendEmailDialog";
import { useCountryStats } from "@/hooks/useCountryStats";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Phone, Mail, ChevronRight, Users, Loader2, Filter,
  FileText, Trophy, Wand2, Send, Download, Telescope, Building2, UserCircle,
} from "lucide-react";
import { usePartners, usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { getCountryFlag, getYearsMember } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "@/components/download/theme";

import { MiniStars } from "@/components/partners/shared/MiniStars";
import { PartnerDetailCompact } from "@/components/partners/PartnerDetailCompact";

/* ── Helpers ── */
function statusColor(missing: number, total: number, isDark: boolean) {
  if (total === 0) return { bg: isDark ? "bg-slate-800/40" : "bg-slate-100", border: isDark ? "border-slate-700/50" : "border-slate-200", text: isDark ? "text-slate-400" : "text-slate-500" };
  const pct = missing / total;
  if (pct === 0) return { bg: isDark ? "bg-emerald-950/40" : "bg-emerald-50", border: isDark ? "border-emerald-500/25" : "border-emerald-300", text: isDark ? "text-emerald-400" : "text-emerald-600" };
  if (pct <= 0.5) return { bg: isDark ? "bg-amber-950/40" : "bg-amber-50", border: isDark ? "border-amber-500/25" : "border-amber-300", text: isDark ? "text-amber-400" : "text-amber-600" };
  return { bg: isDark ? "bg-rose-950/40" : "bg-rose-50", border: isDark ? "border-rose-500/25" : "border-rose-300", text: isDark ? "text-rose-400" : "text-rose-600" };
}

function coverageColor(count: number, total: number, isDark: boolean) {
  if (total === 0 || count === 0) return isDark ? "text-rose-400/60" : "text-rose-400";
  const pct = count / total;
  if (pct >= 0.8) return isDark ? "text-emerald-400" : "text-emerald-600";
  if (pct >= 0.5) return isDark ? "text-amber-400" : "text-amber-600";
  return isDark ? "text-rose-400" : "text-rose-500";
}

type ProgressFilterKey = "profiles" | "deep" | "email" | "phone" | "alias_co" | "alias_ct" | null;

function ProgressBar({ label, value, total, isDark, gradientColor, active, onClick }: {
  label: string; value: number; total: number; isDark: boolean; gradientColor: string; active: boolean; onClick: () => void;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <button onClick={onClick} className={cn(
      "flex items-center gap-2 px-2 py-1 rounded-lg transition-all text-left w-full",
      active
        ? isDark ? "bg-sky-950/50 ring-1 ring-sky-400/30" : "bg-sky-50 ring-1 ring-sky-300/50"
        : isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
    )}>
      <span className={`text-[10px] w-14 shrink-0 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</span>
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${gradientColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono font-bold w-16 text-right ${isDark ? "text-slate-300" : "text-slate-600"}`}>{value}/{total}</span>
    </button>
  );
}

/* ── Action Button ("Testone") ── */
function ActionButton({ icon: Icon, label, missing, total, isDark, onClick, loading, disabled }: {
  icon: any; label: string; missing: number; total: number; isDark: boolean;
  onClick: () => void; loading?: boolean; disabled?: boolean;
}) {
  const st = statusColor(missing, total, isDark);
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading || missing === 0}
      className={cn(
        "flex-1 min-w-0 rounded-xl border-2 p-2.5 transition-all duration-200",
        st.bg, st.border,
        missing > 0 ? "cursor-pointer hover:scale-[1.03] active:scale-[0.98]" : "opacity-60 cursor-default",
        "disabled:opacity-40"
      )}
    >
      <div className="flex items-center gap-2">
        {loading ? <Loader2 className={`w-4 h-4 animate-spin ${st.text}`} /> : <Icon className={`w-4 h-4 ${st.text}`} />}
        <span className={`text-xs font-bold truncate ${isDark ? "text-slate-200" : "text-slate-700"}`}>{label}</span>
      </div>
      <p className={`text-lg font-mono font-extrabold mt-1 ${st.text}`}>{missing}</p>
      <p className={`text-[9px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>mancanti su {total}</p>
    </button>
  );
}

/* ── Props ── */
interface PartnerListPanelProps {
  countryCodes: string[];
  countryNames: string[];
  isDark: boolean;
  onSwitchToDownload?: () => void;
  onDeepSearch?: (partnerIds: string[]) => void;
  onGenerateAliases?: (countryCodes: string[], type: "company" | "contact") => void;
  deepSearchRunning?: boolean;
  aliasGenerating?: boolean;
}

export function PartnerListPanel({
  countryCodes, countryNames, isDark,
  onSwitchToDownload, onDeepSearch, onGenerateAliases,
  deepSearchRunning, aliasGenerating,
}: PartnerListPanelProps) {
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name_asc" | "rating_desc" | "contacts_desc">("name_asc");
  const [progressFilter, setProgressFilter] = useState<ProgressFilterKey>(null);
  const [emailTarget, setEmailTarget] = useState<{ email: string; name: string; company: string; partnerId: string } | null>(null);

  const { data: partners, isLoading } = usePartners({
    countries: countryCodes,
    search: search.length >= 2 ? search : undefined,
  });

  const toggleFavorite = useToggleFavorite();
  const queryClient = useQueryClient();

  /* ── Compute stats from partner data ── */
  const stats = useMemo(() => {
    const list = partners || [];
    const total = list.length;
    let withProfile = 0, withDeep = 0, withEmail = 0, withPhone = 0, withAliasCo = 0, withAliasCt = 0;
    list.forEach((p: any) => {
      if (p.raw_profile_html) withProfile++;
      if (p.enrichment_data && (p.enrichment_data as any)?.deep_search_at) withDeep++;
      if (p.email || (p.partner_contacts || []).some((c: any) => c.email)) withEmail++;
      if (p.phone || (p.partner_contacts || []).some((c: any) => c.direct_phone || c.mobile)) withPhone++;
      if (p.company_alias) withAliasCo++;
      if ((p.partner_contacts || []).some((c: any) => c.contact_alias)) withAliasCt++;
    });
    return { total, withProfile, withDeep, withEmail, withPhone, withAliasCo, withAliasCt };
  }, [partners]);

  const globalPct = stats.total > 0
    ? Math.round(((stats.withProfile + stats.withDeep + stats.withEmail + stats.withPhone + stats.withAliasCo + stats.withAliasCt) / (stats.total * 6)) * 100)
    : 0;

  /* ── Filter partners based on progress bar click ── */
  const filteredPartners = useMemo(() => {
    let list = partners || [];

    // Apply progress filter
    if (progressFilter) {
      list = list.filter((p: any) => {
        switch (progressFilter) {
          case "profiles": return !p.raw_profile_html;
          case "deep": return !(p.enrichment_data && (p.enrichment_data as any)?.deep_search_at);
          case "email": return !p.email && !(p.partner_contacts || []).some((c: any) => c.email);
          case "phone": return !p.phone && !(p.partner_contacts || []).some((c: any) => c.direct_phone || c.mobile);
          case "alias_co": return !p.company_alias;
          case "alias_ct": return !(p.partner_contacts || []).some((c: any) => c.contact_alias);
          default: return true;
        }
      });
    }

    const sorted = [...list];
    switch (sortBy) {
      case "name_asc": return sorted.sort((a: any, b: any) => a.company_name.localeCompare(b.company_name));
      case "rating_desc": return sorted.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
      case "contacts_desc": return sorted.sort((a: any, b: any) => {
        const qa = getPartnerContactQuality(a.partner_contacts);
        const qb = getPartnerContactQuality(b.partner_contacts);
        const order: Record<string, number> = { complete: 0, partial: 1, missing: 2 };
        return (order[qa] || 2) - (order[qb] || 2);
      });
      default: return sorted;
    }
  }, [partners, progressFilter, sortBy]);

  const { data: selectedPartner } = usePartner(selectedId || "");

  if (selectedId && selectedPartner) {
    return (
      <div className="h-full overflow-auto">
        <PartnerDetailCompact
          partner={selectedPartner}
          onBack={() => setSelectedId(null)}
          onToggleFavorite={() => toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })}
          isDark={isDark}
        />
      </div>
    );
  }

  const toggleProgressFilter = (key: ProgressFilterKey) => {
    setProgressFilter(prev => prev === key ? null : key);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col">
        {/* ═══ Global Completion Bar ═══ */}
        {stats.total > 0 && (
          <div className={`px-3 pt-3 pb-1 flex-shrink-0`}>
            <div className={`flex items-center gap-3 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              <span className="font-semibold">Completamento</span>
              <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? "bg-white/[0.08]" : "bg-slate-200/80"}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${globalPct >= 80 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : globalPct >= 50 ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-gradient-to-r from-rose-500 to-rose-400"}`}
                  style={{ width: `${globalPct}%` }}
                />
              </div>
              <span className="font-mono font-bold">{globalPct}%</span>
            </div>
          </div>
        )}

        {/* ═══ 4 Action Buttons ("Tastoni") ═══ */}
        {stats.total > 0 && (
          <div className="px-3 pt-2 pb-1 flex-shrink-0">
            <div className="grid grid-cols-4 gap-2">
              <ActionButton
                icon={Download}
                label="Profili"
                missing={stats.total - stats.withProfile}
                total={stats.total}
                isDark={isDark}
                onClick={() => onSwitchToDownload?.()}
              />
              <ActionButton
                icon={Telescope}
                label="Deep Search"
                missing={stats.total - stats.withDeep}
                total={stats.total}
                isDark={isDark}
                onClick={() => {
                  const ids = (partners || []).filter((p: any) => p.raw_profile_html && !(p.enrichment_data as any)?.deep_search_at).map((p: any) => p.id);
                  if (ids.length > 0) onDeepSearch?.(ids);
                }}
                loading={deepSearchRunning}
              />
              <ActionButton
                icon={Building2}
                label="Alias Az."
                missing={stats.total - stats.withAliasCo}
                total={stats.total}
                isDark={isDark}
                onClick={() => onGenerateAliases?.(countryCodes, "company")}
                loading={aliasGenerating}
              />
              <ActionButton
                icon={UserCircle}
                label="Alias Ct."
                missing={stats.total - stats.withAliasCt}
                total={stats.total}
                isDark={isDark}
                onClick={() => onGenerateAliases?.(countryCodes, "contact")}
                loading={aliasGenerating}
              />
            </div>
          </div>
        )}

        {/* ═══ 6 Clickable Progress Bars ═══ */}
        {stats.total > 0 && (
          <div className={`px-3 pt-1 pb-2 flex-shrink-0 space-y-0.5`}>
            <ProgressBar label="Profili" value={stats.withProfile} total={stats.total} isDark={isDark} gradientColor="from-violet-500 to-purple-500" active={progressFilter === "profiles"} onClick={() => toggleProgressFilter("profiles")} />
            <ProgressBar label="Deep S." value={stats.withDeep} total={stats.total} isDark={isDark} gradientColor="from-cyan-500 to-blue-500" active={progressFilter === "deep"} onClick={() => toggleProgressFilter("deep")} />
            <ProgressBar label="Email" value={stats.withEmail} total={stats.total} isDark={isDark} gradientColor="from-sky-400 to-blue-500" active={progressFilter === "email"} onClick={() => toggleProgressFilter("email")} />
            <ProgressBar label="Telefono" value={stats.withPhone} total={stats.total} isDark={isDark} gradientColor="from-teal-400 to-emerald-500" active={progressFilter === "phone"} onClick={() => toggleProgressFilter("phone")} />
            <ProgressBar label="Alias Az." value={stats.withAliasCo} total={stats.total} isDark={isDark} gradientColor="from-amber-400 to-orange-500" active={progressFilter === "alias_co"} onClick={() => toggleProgressFilter("alias_co")} />
            <ProgressBar label="Alias Ct." value={stats.withAliasCt} total={stats.total} isDark={isDark} gradientColor="from-pink-400 to-rose-500" active={progressFilter === "alias_ct"} onClick={() => toggleProgressFilter("alias_ct")} />
          </div>
        )}

        {/* ═══ Search + Sort ═══ */}
        <div className="px-3 pb-2 space-y-1.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
              <Input
                placeholder="Cerca partner..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`pl-10 h-8 rounded-xl text-xs ${th.input}`}
              />
            </div>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className={`w-[120px] h-8 rounded-xl text-xs ${th.selTrigger}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="name_asc">Nome A-Z</SelectItem>
                <SelectItem value="rating_desc">Rating ↓</SelectItem>
                <SelectItem value="contacts_desc">Contatti ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className={`text-[11px] ${th.dim}`}>
            {isLoading ? "Caricamento..." : `${filteredPartners.length} partner${progressFilter ? " (filtrati)" : ""} in ${countryNames.join(", ")}`}
          </p>
        </div>

        {/* ═══ Partner List ═══ */}
        <ScrollArea className="flex-1">
          <div className={`${isDark ? "divide-white/[0.06]" : "divide-slate-200/60"} divide-y`}>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-3 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))
              : filteredPartners.map((partner: any) => {
                  const q = getPartnerContactQuality(partner.partner_contacts);
                  const years = getYearsMember(partner.member_since);
                  const contacts = partner.partner_contacts || [];
                  const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];

                  return (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedId(partner.id)}
                      className={cn(
                        "p-3 cursor-pointer transition-all duration-200 group",
                        isDark ? "hover:bg-white/[0.06]" : "hover:bg-sky-50/50",
                        q === "missing" && "border-l-4 border-l-red-500",
                        q === "partial" && "border-l-4 border-l-amber-400",
                        q === "complete" && "border-l-4 border-l-emerald-500",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {partner.logo_url ? (
                          <img src={partner.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-white/10 border border-white/10 shrink-0" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        ) : (
                          <div className={`w-8 h-8 rounded-lg shrink-0 ${isDark ? "bg-white/[0.06]" : "bg-slate-100"}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-semibold text-sm truncate ${th.h2}`}>{partner.city}</p>
                              <p className={`text-xs truncate ${th.sub}`}>
                                {partner.company_name}
                                {partner.company_alias && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{partner.company_alias}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {years > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                  <span className="text-xs font-bold text-amber-500">{years}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg leading-none">{getCountryFlag(partner.country_code)}</span>
                            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-xs">
                            {primaryContact ? (
                              <>
                                <span className={`truncate max-w-[100px] ${th.dim}`}>{primaryContact.name}</span>
                                <Mail className={cn("w-3.5 h-3.5", primaryContact.email ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                                <Phone className={cn("w-3.5 h-3.5", (primaryContact.direct_phone || primaryContact.mobile) ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                                {contacts.length > 1 && <span className={`text-[10px] ${th.dim}`}>+{contacts.length - 1}</span>}
                              </>
                            ) : (
                              <span className={`italic ${th.dim}`}>Nessun contatto</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                          {primaryContact?.email && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEmailTarget({
                                      email: primaryContact.email,
                                      name: primaryContact.name,
                                      company: partner.company_name,
                                      partnerId: partner.id,
                                    });
                                  }}
                                  className={cn(
                                    "p-1.5 rounded-lg border transition-all opacity-0 group-hover:opacity-100",
                                    isDark
                                      ? "bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20"
                                      : "bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100"
                                  )}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">
                                Invia email a {primaryContact.email}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <ChevronRight className={`w-4 h-4 ${th.dim} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </ScrollArea>
      </div>
      {emailTarget && (
        <SendEmailDialog
          open={!!emailTarget}
          onOpenChange={(open) => { if (!open) setEmailTarget(null); }}
          recipientEmail={emailTarget.email}
          recipientName={emailTarget.name}
          companyName={emailTarget.company}
          partnerId={emailTarget.partnerId}
          isDark={isDark}
        />
      )}
    </TooltipProvider>
  );
}

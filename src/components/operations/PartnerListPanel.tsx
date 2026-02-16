import { useState, useMemo, useCallback } from "react";
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
  FileText, Trophy, Wand2, Send,
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

function coverageColor(count: number, total: number, isDark: boolean) {
  if (total === 0 || count === 0) return isDark ? "text-rose-400/60" : "text-rose-400";
  const pct = count / total;
  if (pct >= 0.8) return isDark ? "text-emerald-400" : "text-emerald-600";
  if (pct >= 0.5) return isDark ? "text-amber-400" : "text-amber-600";
  return isDark ? "text-rose-400" : "text-rose-500";
}

function MiniProgress({ label, value, total, isDark, color }: { label: string; value: number; total: number; isDark: boolean; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex-1 flex items-center gap-1.5 min-w-0">
      <span className={`text-[9px] w-8 shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{label}</span>
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[9px] font-bold w-7 text-right ${isDark ? "text-slate-400" : "text-slate-500"}`}>{pct}%</span>
    </div>
  );
}

interface PartnerListPanelProps {
  countryCodes: string[];
  countryNames: string[];
  isDark: boolean;
}

export function PartnerListPanel({ countryCodes, countryNames, isDark }: PartnerListPanelProps) {
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name_asc" | "rating_desc" | "contacts_desc">("name_asc");
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [generatingAliases, setGeneratingAliases] = useState(false);

  const { data: partners, isLoading } = usePartners({
    countries: countryCodes,
    search: search.length >= 2 ? search : undefined,
  });

  const toggleFavorite = useToggleFavorite();
  const queryClient = useQueryClient();

  const handleGenerateAliases = useCallback(async () => {
    if (!countryCodes.length) return;
    setGeneratingAliases(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-aliases", {
        body: { countryCodes },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Alias generati: ${data.processed} aziende, ${data.contacts} contatti`);
        queryClient.invalidateQueries({ queryKey: ["partners"] });
      } else {
        toast.error(data?.error || "Errore nella generazione alias");
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore");
    } finally {
      setGeneratingAliases(false);
    }
  }, [countryCodes, queryClient]);

  const filteredPartners = useMemo(() => {
    let list = filterIncomplete
      ? (partners || []).filter((p: any) => getPartnerContactQuality(p.partner_contacts) !== "complete")
      : partners || [];

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
  }, [partners, filterIncomplete, sortBy]);

  const { data: selectedPartner, isLoading: detailLoading } = usePartner(selectedId || "");
  const { data: countryStatsData } = useCountryStats();

  const aggregatedStats = useMemo(() => {
    if (!countryStatsData) return null;
    let total = 0, withProfile = 0, withoutProfile = 0, withEmail = 0, withPhone = 0;
    countryCodes.forEach(cc => {
      const s = countryStatsData.byCountry[cc];
      if (s) {
        total += s.total_partners;
        withProfile += s.with_profile;
        withoutProfile += s.without_profile;
        withEmail += s.with_email;
        withPhone += s.with_phone;
      }
    });
    return { total, withProfile, withoutProfile, withEmail, withPhone };
  }, [countryStatsData, countryCodes]);

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col">
        {/* Country Summary Stats */}
        {aggregatedStats && aggregatedStats.total > 0 && (
          <div className={`px-3 pt-3 pb-1 flex-shrink-0`}>
            <div className={`text-[11px] font-mono rounded-lg border px-3 py-2 space-y-1.5 ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50/80 border-slate-200/60"}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`flex items-center gap-1 font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                  <Users className="w-3.5 h-3.5" />{aggregatedStats.total}
                </span>
                <span className={`flex items-center gap-1 ${aggregatedStats.withoutProfile > 0 ? (isDark ? "text-orange-400" : "text-orange-600") : (isDark ? "text-emerald-400" : "text-emerald-600")}`}>
                  <FileText className="w-3.5 h-3.5" />{aggregatedStats.withProfile}
                  {aggregatedStats.withoutProfile > 0 && <span className="text-[9px]">({aggregatedStats.withoutProfile} ✗)</span>}
                </span>
                <span className={`flex items-center gap-1 ${coverageColor(aggregatedStats.withEmail, aggregatedStats.total, isDark)}`}>
                  <Mail className="w-3.5 h-3.5" />{aggregatedStats.withEmail}
                </span>
                <span className={`flex items-center gap-1 ${coverageColor(aggregatedStats.withPhone, aggregatedStats.total, isDark)}`}>
                  <Phone className="w-3.5 h-3.5" />{aggregatedStats.withPhone}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MiniProgress label="Profili" value={aggregatedStats.withProfile} total={aggregatedStats.total} isDark={isDark} color="from-violet-500 to-purple-500" />
                <MiniProgress label="Email" value={aggregatedStats.withEmail} total={aggregatedStats.total} isDark={isDark} color="from-sky-400 to-blue-500" />
                <MiniProgress label="Tel" value={aggregatedStats.withPhone} total={aggregatedStats.total} isDark={isDark} color="from-teal-400 to-emerald-500" />
              </div>
            </div>
          </div>
        )}
        {/* Search + Sort */}
        <div className="p-3 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
              <Input
                placeholder="Cerca partner..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`pl-10 h-9 rounded-xl text-sm ${th.input}`}
              />
            </div>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className={`w-[140px] h-9 rounded-xl text-xs ${th.selTrigger}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="name_asc">Nome A-Z</SelectItem>
                <SelectItem value="rating_desc">Rating ↓</SelectItem>
                <SelectItem value="contacts_desc">Contatti ↓</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => setFilterIncomplete(!filterIncomplete)}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-all shrink-0 ${
                filterIncomplete
                  ? isDark ? "bg-sky-500/15 text-sky-300 border-sky-500/25" : "bg-sky-50 text-sky-700 border-sky-200"
                  : isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-400" : "bg-white/70 border-slate-200 text-slate-500"
              }`}
            >
              <Filter className="w-3 h-3" />
              Incompleti
            </button>
            <button
              onClick={handleGenerateAliases}
              disabled={generatingAliases || !countryCodes.length}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-all shrink-0 ${
                isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-400 hover:bg-white/[0.1]" : "bg-white/70 border-slate-200 text-slate-500 hover:bg-white"
              } disabled:opacity-40`}
            >
              {generatingAliases ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              Alias
            </button>
          </div>
          <p className={`text-xs ${th.dim}`}>
            {isLoading ? "Caricamento..." : `${filteredPartners.length} partner in ${countryNames.join(", ")}`}
          </p>
        </div>

        {/* Partner List */}
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
                          {/* Contact info */}
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
                                    const subject = encodeURIComponent(`Contatto da ${partner.company_name}`);
                                    const mailto = `mailto:${primaryContact.email}?subject=${subject}`;
                                    window.open(mailto, "_blank");
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
    </TooltipProvider>
  );
}

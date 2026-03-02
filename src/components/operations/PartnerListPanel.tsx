import { useState, useMemo, useCallback } from "react";
import { SendEmailDialog } from "@/components/operations/SendEmailDialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Phone, Mail, ChevronRight, Loader2,
  FileText, Trophy, Wand2, Send, Download, Telescope, Building2, UserCircle,
  Zap, FolderDown, RefreshCw, Square, CheckCircle2, MailX,
} from "lucide-react";
import { usePartners, useToggleFavorite } from "@/hooks/usePartners";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { getCountryFlag, getYearsMember } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { t } from "@/components/download/theme";
import { DownloadTerminal } from "@/components/download/DownloadTerminal";
import { JobMonitor } from "@/components/download/JobMonitor";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { getRealLogoUrl } from "@/lib/partnerUtils";

import { useDirectoryDownload } from "@/hooks/useDirectoryDownload";
import { usePartnerListStats } from "@/hooks/usePartnerListStats";
import { IconIndicator, StatusDot, HorizStep, DownloadChoice, FilterActionBar } from "./partner-list/SubComponents";

/* ── Props ── */
interface PartnerListPanelProps {
  countryCodes: string[];
  countryNames: string[];
  isDark: boolean;
  onDeepSearch?: (partnerIds: string[]) => void;
  onGenerateAliases?: (countryCodes: string[], type: "company" | "contact") => void;
  deepSearchRunning?: boolean;
  aliasGenerating?: boolean;
  onJobCreated?: (jobId: string) => void;
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
  onSelectPartner?: (id: string | null) => void;
  selectedPartnerId?: string | null;
}

export function PartnerListPanel({
  countryCodes, countryNames, isDark,
  onDeepSearch, onGenerateAliases,
  deepSearchRunning, aliasGenerating,
  onJobCreated, directoryOnly: directoryOnlyProp, onDirectoryOnlyChange,
  onSelectPartner, selectedPartnerId,
}: PartnerListPanelProps) {
  const th = t(isDark);
  const countryCode = countryCodes[0] || "";
  const countryName = countryNames[0] || "";
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name_asc" | "rating_desc" | "contacts_desc">("name_asc");
  type ProgressFilterKey = "profiles" | "deep" | "email" | "phone" | "alias_co" | "alias_ct" | null;
  const [progressFilter, setProgressFilter] = useState<ProgressFilterKey>(null);
  const [emailTarget, setEmailTarget] = useState<{ email: string; name: string; company: string; partnerId: string } | null>(null);

  const { data: partners, isLoading } = usePartners({
    countries: countryCodes,
    search: search.length >= 2 ? search : undefined,
  });

  const toggleFavorite = useToggleFavorite();

  // ── Hooks ──
  const dl = useDirectoryDownload({
    countryCodes, countryNames, onJobCreated,
    directoryOnly: directoryOnlyProp, onDirectoryOnlyChange,
  });

  const { stats, verified, missingProfiles, missingDeep, missingAliasCo, missingAliasCt } = usePartnerListStats({ countryCodes, partners });

  // ── Filtered & sorted partners ──
  const filteredPartners = useMemo(() => {
    let list = partners || [];
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

  const handleSelectPartner = useCallback((id: string) => {
    if (onSelectPartner) onSelectPartner(id);
  }, [onSelectPartner]);

  const toggleProgressFilter = (key: ProgressFilterKey) => {
    setProgressFilter(prev => prev === key ? null : key);
  };

  const totalCount = dl.uniqueIds.length > 0 ? dl.uniqueIds.length : stats.total;
  const downloadedCount = dl.uniqueIds.length > 0 ? dl.uniqueIds.filter(id => dl.dbWcaSet.has(id)).length : stats.withProfile;

  const hasDownloadableIds = dl.idsToDownload.length > 0 || dl.missingIds.length > 0;
  const wizardStep = (missingProfiles > 0 || hasDownloadableIds) ? 1 : missingDeep > 0 ? 2 : (missingAliasCo > 0 || missingAliasCt > 0) ? 3 : 4;
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full min-h-0 flex flex-col">
        {/* ═══ COMPACT HEADER ═══ */}
        <div className="px-3 pt-2.5 pb-1 flex-shrink-0 space-y-2">
          {/* ROW 1: Country + progress + wizard */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {countryCodes.slice(0, 5).map(cc => (
                <span key={cc} className="text-lg leading-none">{getCountryFlag(cc)}</span>
              ))}
              {countryCodes.length > 5 && <span className={cn("text-[10px] font-bold ml-0.5", isDark ? "text-slate-400" : "text-slate-500")}>+{countryCodes.length - 5}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={cn("text-sm font-bold truncate", isDark ? "text-slate-100" : "text-slate-800")}>
                {countryCodes.length === 1 ? countryName : `${countryCodes.length} paesi`}
              </h2>
              {totalCount > 0 && (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={cn("flex-1 h-2 rounded-full overflow-hidden", isDark ? "bg-white/[0.06]" : "bg-slate-200/60")}>
                    <div
                      className={cn("h-full rounded-full transition-all duration-500",
                        downloadedCount >= totalCount ? "bg-emerald-500" : downloadedCount >= totalCount * 0.5 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ width: `${Math.min(100, Math.round((downloadedCount / totalCount) * 100))}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] font-mono font-bold tabular-nums whitespace-nowrap",
                    downloadedCount >= totalCount ? "text-emerald-500" : "text-amber-500"
                  )}>
                    {downloadedCount}/{totalCount} ({Math.round((downloadedCount / totalCount) * 100)}%)
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setWizardOpen(p => !p)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all shrink-0",
                wizardStep < 4
                  ? isDark ? "bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/25" : "bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100"
                  : isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600"
              )}
            >
              {wizardStep < 4 ? <><Zap className="w-3 h-3" /> Step {wizardStep}/3</> : <><CheckCircle2 className="w-3 h-3" /> OK</>}
            </button>
          </div>

          {/* ROW 2: Counts + 6 icon indicators */}
          <div className="flex items-center gap-1">
            <div className={cn("flex items-center gap-1.5 mr-1.5 pr-1.5 border-r", isDark ? "border-white/[0.08]" : "border-slate-200")}>
              <span className={cn("text-[10px] font-bold tabular-nums", isDark ? "text-slate-300" : "text-slate-600")}>{stats.total}</span>
              <span className={cn("text-[9px]", isDark ? "text-slate-600" : "text-slate-400")}>tot</span>
              <span className={cn("text-[10px] font-bold tabular-nums", isDark ? "text-emerald-400" : "text-emerald-600")}>{stats.withProfile}</span>
              <span className={cn("text-[9px]", isDark ? "text-slate-600" : "text-slate-400")}>↓</span>
            </div>
            <IconIndicator icon={FileText} count={stats.total - stats.withProfile} label="Senza Profilo" isDark={isDark} onClick={() => toggleProgressFilter("profiles")} active={progressFilter === "profiles"} />
            <IconIndicator icon={Mail} count={stats.total - stats.withEmail} label="Senza Email" isDark={isDark} onClick={() => toggleProgressFilter("email")} active={progressFilter === "email"} verified={verified.email} />
            <IconIndicator icon={Phone} count={stats.total - stats.withPhone} label="Senza Telefono" isDark={isDark} onClick={() => toggleProgressFilter("phone")} active={progressFilter === "phone"} verified={verified.phone} />
            <div className={cn("w-px h-5 mx-0.5", isDark ? "bg-white/[0.08]" : "bg-slate-200")} />
            <IconIndicator icon={Telescope} count={stats.total - stats.withDeep} label="Senza Deep Search" isDark={isDark} onClick={() => toggleProgressFilter("deep")} active={progressFilter === "deep"} verified={verified.deep} />
            <IconIndicator icon={Building2} count={stats.total - stats.withAliasCo} label="Senza Alias Azienda" isDark={isDark} onClick={() => toggleProgressFilter("alias_co")} active={progressFilter === "alias_co"} verified={verified.aliasCo} />
            <IconIndicator icon={UserCircle} count={stats.total - stats.withAliasCt} label="Senza Alias Contatto" isDark={isDark} onClick={() => toggleProgressFilter("alias_ct")} active={progressFilter === "alias_ct"} verified={verified.aliasCt} />
          </div>

          {/* ROW 3: Search + sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${th.dim}`} />
              <Input placeholder="Cerca partner..." value={search} onChange={e => setSearch(e.target.value)} className={`pl-8 h-7 rounded-lg text-xs ${th.input}`} />
            </div>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className={`w-[100px] h-7 rounded-lg text-[11px] ${th.selTrigger}`}><SelectValue /></SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="name_asc" className="text-xs">Nome A-Z</SelectItem>
                <SelectItem value="rating_desc" className="text-xs">Rating ↓</SelectItem>
                <SelectItem value="contacts_desc" className="text-xs">Contatti ↓</SelectItem>
              </SelectContent>
            </Select>
            <span className={cn("text-[10px] tabular-nums whitespace-nowrap", th.dim)}>
              {isLoading ? "..." : `${filteredPartners.length}${progressFilter ? " filtrati" : ""}`}
            </span>
          </div>

          {/* Filter Action Bar */}
          {progressFilter && filteredPartners.length > 0 && (
            <FilterActionBar
              filter={progressFilter}
              count={filteredPartners.length}
              isDark={isDark}
              onDownload={async () => {
                const filteredWcaIds = filteredPartners.map((p: any) => p.wca_id).filter((id: number | null): id is number => id != null);
                if (filteredWcaIds.length === 0) { toast.error("Nessun partner filtrato ha un WCA ID"); return; }
                const sessionOk = await dl.ensureSession();
                if (!sessionOk) { toast.error("Sessione WCA non attiva."); return; }
                const { data: activeJobs } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
                if (activeJobs && activeJobs.length > 0) { toast.error("Job già in corso."); return; }
                const primaryCode = countryCodes[0] || "";
                const primaryName = countryNames.length > 1 ? `${countryNames[0]} +${countryNames.length - 1}` : countryNames[0] || "";
                const jobId = await dl.createJob.mutateAsync({
                  country_code: primaryCode, country_name: primaryName,
                  network_name: dl.networks.length > 0 ? dl.networks.join(", ") : "Tutti",
                  wca_ids: filteredWcaIds, delay_seconds: Math.max(dl.delay, 10),
                });
                if (jobId && onJobCreated) onJobCreated(jobId);
              }}
              onDeepSearch={() => {
                const ids = filteredPartners.map((p: any) => p.id);
                if (ids.length > 0) onDeepSearch?.(ids);
              }}
              onGenerateAlias={(type) => onGenerateAliases?.(countryCodes, type)}
              deepSearchRunning={deepSearchRunning}
              aliasGenerating={aliasGenerating}
            />
          )}
        </div>

        {/* ═══ WIZARD ═══ */}
        {wizardOpen && (
          <div className="px-3 pb-1.5 flex-shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className={cn("rounded-xl border p-2", isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50/60 border-slate-200/60")}>
              {wizardStep === 4 ? (
                <div className="flex items-center gap-2 py-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className={cn("text-sm font-bold", isDark ? "text-emerald-400" : "text-emerald-600")}>Paese completato!</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 mb-2">
                    <HorizStep step={1} active={wizardStep === 1} done={missingProfiles === 0} isDark={isDark} icon={Download} label="Profili" missing={missingProfiles} />
                    <div className={cn("flex-shrink-0 w-4 h-px", isDark ? "bg-white/[0.1]" : "bg-slate-200")} />
                    <HorizStep step={2} active={wizardStep === 2} done={missingDeep === 0} isDark={isDark} icon={Telescope} label="Deep" missing={missingDeep} />
                    <div className={cn("flex-shrink-0 w-4 h-px", isDark ? "bg-white/[0.1]" : "bg-slate-200")} />
                    <HorizStep step={3} active={wizardStep === 3} done={missingAliasCo === 0 && missingAliasCt === 0} isDark={isDark} icon={Wand2} label="Alias" missing={missingAliasCo + missingAliasCt} />
                  </div>

                  {wizardStep === 1 && !dl.isScanning && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <DownloadChoice selected={dl.downloadMode === "new"} onClick={() => dl.setDownloadMode("new")} isDark={isDark} icon={FolderDown} title="Nuovi" description={`${dl.missingIds.length} da importare`} count={dl.missingIds.length} color="text-sky-400" />
                        <DownloadChoice selected={dl.downloadMode === "no_profile"} onClick={() => dl.setDownloadMode("no_profile")} isDark={isDark} icon={FileText} title="Incompleti" description={`${dl.noProfileInDirectoryCount + dl.missingIds.length} senza profilo`} count={dl.noProfileInDirectoryCount + dl.missingIds.length} color="text-amber-400" />
                        <DownloadChoice selected={dl.downloadMode === "no_email"} onClick={() => dl.setDownloadMode("no_email")} isDark={isDark} icon={MailX} title="Senza Email" description={`${dl.noEmailIds.length} da riprovare`} count={dl.noEmailIds.length} color="text-orange-400" />
                        <DownloadChoice selected={dl.downloadMode === "all"} onClick={() => dl.setDownloadMode("all")} isDark={isDark} icon={RefreshCw} title="Tutti" description={`Aggiorna ${totalCount} partner`} count={totalCount} color="text-violet-400" />
                      </div>
                      <div className={cn("flex items-center justify-between text-[10px] font-mono px-1", isDark ? "text-slate-500" : "text-slate-400")}>
                        <span>⏱ {dl.delay}s delay</span>
                        <span>{dl.estimateLabel}</span>
                      </div>
                      <Button onClick={() => dl.handleStartDownload()} disabled={dl.idsToDownload.length === 0 || dl.createJob.isPending}
                        className={cn("w-full h-9 text-xs font-bold rounded-xl transition-all", dl.idsToDownload.length > 0 ? isDark ? "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20" : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30" : "")}>
                        {dl.createJob.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Avvio...</> : <><Download className="w-4 h-4 mr-1" /> SCARICA {dl.idsToDownload.length}</>}
                      </Button>
                      {dl.hasCache && !dl.scanComplete && (
                        <button onClick={dl.handleStartScan} className={cn("flex items-center gap-1 text-[10px] mx-auto transition-colors", isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")}>
                          <RefreshCw className="w-3 h-3" /> Sincronizza Directory
                        </button>
                      )}
                    </div>
                  )}
                  {wizardStep === 1 && dl.isScanning && (
                    <div className="text-center space-y-1 py-1">
                      <Loader2 className={cn("w-4 h-4 animate-spin mx-auto", isDark ? "text-amber-400" : "text-amber-500")} />
                      <p className={cn("text-[10px]", isDark ? "text-slate-400" : "text-slate-500")}>{countryName} — Pg {dl.currentPage}</p>
                      {dl.scannedMembers.length > 0 && <p className={cn("text-xs font-mono font-bold", isDark ? "text-white" : "text-slate-800")}>{dl.scannedMembers.length} trovati</p>}
                      {dl.scanError && <p className="text-[10px] text-red-400">⚠️ {dl.scanError}</p>}
                      <Button size="sm" variant="ghost" onClick={dl.stopScan} className="text-[10px]">
                        <Square className="w-3 h-3 mr-1" /> Stop
                      </Button>
                    </div>
                  )}
                  {wizardStep === 2 && (
                    <Button size="sm" className={cn("w-full h-8 text-xs font-bold", isDark ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-cyan-500 hover:bg-cyan-600 text-white")}
                      disabled={deepSearchRunning}
                      onClick={() => {
                        const ids = (partners || []).filter((p: any) => p.raw_profile_html && !(p.enrichment_data as any)?.deep_search_at).map((p: any) => p.id);
                        if (ids.length > 0) onDeepSearch?.(ids);
                      }}>
                      {deepSearchRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> In corso...</> : <><Telescope className="w-3.5 h-3.5 mr-1" /> Deep Search ({missingDeep})</>}
                    </Button>
                  )}
                  {wizardStep === 3 && (
                    <Button size="sm" className={cn("w-full h-8 text-xs font-bold", isDark ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-amber-500 hover:bg-amber-600 text-white")}
                      disabled={aliasGenerating || (missingAliasCo === 0 && missingAliasCt === 0)}
                      onClick={() => onGenerateAliases?.(countryCodes, "company")}>
                      {aliasGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Generazione...</> : <><Wand2 className="w-3.5 h-3.5 mr-1" /> Genera Alias ({missingAliasCo + missingAliasCt})</>}
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="max-h-24 overflow-auto space-y-1 mt-1.5">
              <DownloadTerminal />
              <JobMonitor />
            </div>
          </div>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {!isLoading && !dl.hasCache && dl.dbPartners.length === 0 && stats.total === 0 && countryCodes.length > 0 && !wizardOpen && (
          <div className="flex-shrink-0 px-3 pb-2">
            <div className={cn("rounded-xl border-2 border-dashed p-6 text-center space-y-3", isDark ? "border-sky-500/20 bg-sky-950/20" : "border-sky-300/40 bg-sky-50/50")}>
              <div className={cn("w-12 h-12 rounded-xl mx-auto flex items-center justify-center", isDark ? "bg-sky-500/10" : "bg-sky-100")}>
                <FolderDown className={cn("w-6 h-6", isDark ? "text-sky-400" : "text-sky-500")} />
              </div>
              <div>
                <p className={cn("text-sm font-bold", isDark ? "text-slate-100" : "text-slate-800")}>Nessun dato per {countryName}</p>
                <p className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-500")}>Scansiona la directory WCA per scoprire i partner disponibili</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={dl.handleStartScan} disabled={dl.isScanning}
                  className={cn("w-full h-10 text-sm font-bold rounded-xl", isDark ? "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20" : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30")}>
                  {dl.isScanning ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Scansione...</> : <><Search className="w-4 h-4 mr-2" /> Scansiona Directory</>}
                </Button>
                <Button variant="outline" onClick={dl.startScanThenDownload} disabled={dl.isScanning}
                  className={cn("w-full h-8 text-xs font-semibold rounded-xl", isDark ? "border-white/[0.1] text-slate-300 hover:bg-white/[0.05]" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> Scansiona + Download Automatico
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PARTNER LIST ═══ */}
        <div className="flex-1 min-h-0 overflow-y-auto">
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
                  const hasProfile = !!partner.raw_profile_html;
                  const hasEmail = !!partner.email || contacts.some((c: any) => c.email);
                  const hasPhone = !!partner.phone || contacts.some((c: any) => c.direct_phone || c.mobile);
                  const hasDeep = !!(partner.enrichment_data as any)?.deep_search_at;

                  return (
                    <div key={partner.id} onClick={() => handleSelectPartner(partner.id)}
                      className={cn(
                        "px-3 py-2 cursor-pointer transition-all duration-150 group",
                        selectedPartnerId === partner.id
                          ? isDark ? "bg-sky-950/40" : "bg-sky-50"
                          : isDark ? "hover:bg-white/[0.04]" : "hover:bg-sky-50/40",
                      )}>
                      <div className="flex items-center gap-2.5">
                        {getRealLogoUrl(partner.logo_url) ? (
                          <img src={getRealLogoUrl(partner.logo_url)!} alt="" className="w-7 h-7 rounded-md object-contain bg-white/10 border border-white/10 shrink-0" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        ) : (
                          <div className={cn("w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold", isDark ? "bg-white/[0.06] text-slate-500" : "bg-slate-100 text-slate-400")}>
                            {partner.company_name?.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={cn("font-bold text-xs truncate", isDark ? "text-slate-100" : "text-slate-800")}>{partner.company_name}</p>
                            {partner.company_alias && (
                              <span className={cn("text-[9px] px-1 py-0.5 rounded shrink-0", isDark ? "bg-teal-900/30 text-teal-400" : "bg-teal-100 text-teal-700")}>{partner.company_alias}</span>
                            )}
                            {years > 0 && (
                              <span className="flex items-center gap-0.5 shrink-0">
                                <Trophy className="w-3 h-3 text-amber-500 fill-amber-500" />
                                <span className="text-[10px] font-bold text-amber-500">{years}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("text-[11px] truncate", isDark ? "text-slate-400" : "text-slate-500")}>{partner.city}</span>
                            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} size="w-2.5 h-2.5" />}
                            {primaryContact && (
                              <span className={cn("text-[10px] truncate max-w-[80px]", isDark ? "text-slate-500" : "text-slate-400")}>· {primaryContact.name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <StatusDot ok={hasProfile} label="Profilo" isDark={isDark} />
                          <StatusDot ok={hasEmail} label="Email" isDark={isDark} />
                          <StatusDot ok={hasPhone} label="Telefono" isDark={isDark} />
                          <StatusDot ok={hasDeep} label="Deep Search" isDark={isDark} />
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {primaryContact?.email && (
                            <button onClick={(e) => { e.stopPropagation(); setEmailTarget({ email: primaryContact.email, name: primaryContact.name, company: partner.company_name, partnerId: partner.id }); }}
                              className={cn("p-1 rounded-md transition-all", isDark ? "text-sky-400 hover:bg-sky-500/20" : "text-sky-600 hover:bg-sky-50")}>
                              <Send className="w-3 h-3" />
                            </button>
                          )}
                          <ChevronRight className={cn("w-3.5 h-3.5", isDark ? "text-slate-600" : "text-slate-300")} />
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>
      {emailTarget && (
        <SendEmailDialog open={!!emailTarget} onOpenChange={(open) => { if (!open) setEmailTarget(null); }}
          recipientEmail={emailTarget.email} recipientName={emailTarget.name} companyName={emailTarget.company} partnerId={emailTarget.partnerId} isDark={isDark} />
      )}
    </TooltipProvider>
  );
}

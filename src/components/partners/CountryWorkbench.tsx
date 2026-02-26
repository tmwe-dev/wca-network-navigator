import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import {
  ArrowLeft, Phone, Mail, AlertTriangle, Download,
  CheckCircle2, CheckSquare, MapPin, Star, Search,
  Sparkles, Tags, UserCheck, Loader2,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";

/* ── Helpers ── */
const hasPhone = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.mobile || c.direct_phone);
const hasEmail = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.email);
const hasProfile = (p: any) => !!p.raw_profile_html;
const hasDeepSearch = (p: any) => !!(p.enrichment_data as any)?.deep_search_at;
const hasCompanyAlias = (p: any) => !!p.company_alias;
const hasContactAlias = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.contact_alias);

type FilterTag = "with_phone" | "with_email" | "deep_search" | "no_phone" | "no_email" | "no_profile" | "no_deep_search";

const FILTER_FNS: Record<FilterTag, (p: any) => boolean> = {
  with_phone: hasPhone,
  with_email: hasEmail,
  deep_search: hasDeepSearch,
  no_phone: (p) => !hasPhone(p),
  no_email: (p) => !hasEmail(p),
  no_profile: (p) => !hasProfile(p),
  no_deep_search: (p) => !hasDeepSearch(p),
};

/* ── Props ── */
interface CountryWorkbenchProps {
  countryCode: string;
  partners: any[];
  onBack: () => void;
  onSelectPartner: (id: string) => void;
  selectedId: string | null;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAllFiltered: (ids: string[]) => void;
  onDownloadProfiles?: (countryCode: string) => void;
  onDeepSearch?: (partnerIds: string[]) => void;
  onGenerateAliases?: (countryCode: string, type: "company" | "contact") => void;
  deepSearching?: boolean;
  deepSearchProgress?: { current: number; total: number } | null;
  aliasGenerating?: "company" | "contact" | null;
}

/* ── Action Button Card ── */
function ActionButton({
  icon: Icon,
  title,
  count,
  total,
  onClick,
  disabled,
  loading,
  loadingLabel,
}: {
  icon: any;
  title: string;
  count: number;
  total: number;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}) {
  const pct = total > 0 ? ((total - count) / total) * 100 : 100;
  const status = count === 0 ? "done" : pct < 50 ? "critical" : "partial";

  const colors = {
    done: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    partial: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
    critical: "border-destructive/30 bg-destructive/5 text-destructive",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || count === 0 || loading}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all",
        "hover:scale-[1.02] active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        colors[status],
      )}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-[10px] font-medium">{loadingLabel || "..."}</span>
        </>
      ) : count === 0 ? (
        <>
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Completo</span>
        </>
      ) : (
        <>
          <Icon className="w-5 h-5" />
          <span className="text-xs font-bold">{count}</span>
          <span className="text-[10px] leading-tight text-center">{title}</span>
        </>
      )}
    </button>
  );
}

/* ── Progress Row ── */
function ProgressRow({
  label,
  value,
  total,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 text-xs w-full py-1 px-1 rounded transition-colors",
        onClick && "hover:bg-accent/50 cursor-pointer",
        active && "bg-accent",
      )}
    >
      <span className="w-16 text-muted-foreground text-right shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-14 text-right font-mono text-muted-foreground shrink-0">
        {value}/{total}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════ */
/*           MAIN COMPONENT              */
/* ══════════════════════════════════════ */
export function CountryWorkbench({
  countryCode, partners, onBack, onSelectPartner,
  selectedId, selectedIds, onToggleSelection, onSelectAllFiltered,
  onDownloadProfiles, onDeepSearch, onGenerateAliases,
  deepSearching, deepSearchProgress, aliasGenerating,
}: CountryWorkbenchProps) {
  const [activeFilters, setActiveFilters] = useState<Set<FilterTag>>(new Set());

  const toggleFilter = useCallback((tag: FilterTag) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const countryName = WCA_COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
  const flag = getCountryFlag(countryCode);

  const countryPartners = useMemo(
    () => (partners || []).filter((p: any) => p.country_code === countryCode),
    [partners, countryCode]
  );

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total = countryPartners.length;
    const withProfile = countryPartners.filter(hasProfile).length;
    const withDeep = countryPartners.filter(hasDeepSearch).length;
    const withPhone = countryPartners.filter(hasPhone).length;
    const withEmail = countryPartners.filter(hasEmail).length;
    const withCoAlias = countryPartners.filter(hasCompanyAlias).length;
    const withCtAlias = countryPartners.filter(hasContactAlias).length;

    const completionScore = total > 0
      ? Math.round(((withProfile + withDeep + withPhone + withEmail + withCoAlias + withCtAlias) / (total * 6)) * 100)
      : 0;

    return {
      total, withProfile, noProfile: total - withProfile,
      withDeep, noDeep: total - withDeep,
      withPhone, withEmail,
      withCoAlias, noCoAlias: total - withCoAlias,
      withCtAlias, noCtAlias: total - withCtAlias,
      completionScore,
    };
  }, [countryPartners]);

  /* ── Dynamic filter counts ── */
  const dynamicCounts = useMemo(() => {
    const countFor = (excludeTag: FilterTag, predicate: (p: any) => boolean) => {
      let list = countryPartners;
      for (const tag of activeFilters) {
        if (tag === excludeTag) continue;
        list = list.filter(FILTER_FNS[tag]);
      }
      return list.filter(predicate).length;
    };
    return {
      with_phone: countFor("with_phone", hasPhone),
      with_email: countFor("with_email", hasEmail),
      deep_search: countFor("deep_search", hasDeepSearch),
      no_phone: countFor("no_phone", (p) => !hasPhone(p)),
      no_email: countFor("no_email", (p) => !hasEmail(p)),
      no_profile: countFor("no_profile", (p) => !hasProfile(p)),
      no_deep_search: countFor("no_deep_search", (p) => !hasDeepSearch(p)),
    };
  }, [countryPartners, activeFilters]);

  const filteredPartners = useMemo(() => {
    let list = countryPartners;
    for (const tag of activeFilters) list = list.filter(FILTER_FNS[tag]);
    return list.sort((a: any, b: any) => a.company_name.localeCompare(b.company_name));
  }, [countryPartners, activeFilters]);

  const allSelected = filteredPartners.length > 0 && filteredPartners.every((p: any) => selectedIds.has(p.id));

  const handleSelectAll = useCallback(() => {
    onSelectAllFiltered(allSelected ? [] : filteredPartners.map((p: any) => p.id));
  }, [allSelected, filteredPartners, onSelectAllFiltered]);

  /* ── Filter chips config ── */
  const positiveFilters = [
    { key: "with_phone" as FilterTag, label: "Tel", count: dynamicCounts.with_phone },
    { key: "with_email" as FilterTag, label: "Email", count: dynamicCounts.with_email },
    { key: "deep_search" as FilterTag, label: "Deep", count: dynamicCounts.deep_search },
  ];
  const negativeFilters = [
    { key: "no_phone" as FilterTag, label: "No Tel", count: dynamicCounts.no_phone },
    { key: "no_email" as FilterTag, label: "No Email", count: dynamicCounts.no_email },
    { key: "no_profile" as FilterTag, label: "No Prof", count: dynamicCounts.no_profile },
    { key: "no_deep_search" as FilterTag, label: "No Deep", count: dynamicCounts.no_deep_search },
  ];

  /* ── Deep search: get IDs without deep search ── */
  const handleDeepSearchClick = useCallback(() => {
    const ids = countryPartners.filter((p) => hasProfile(p) && !hasDeepSearch(p)).map((p) => p.id);
    if (ids.length > 0 && onDeepSearch) onDeepSearch(ids);
  }, [countryPartners, onDeepSearch]);

  return (
    <div className="flex flex-col h-full">
      {/* ═══ HEADER ═══ */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xl">{flag}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold leading-tight truncate">{countryName}</h2>
            <p className="text-[10px] text-muted-foreground">{stats.total} partner · {stats.completionScore}% completo</p>
          </div>
        </div>
        {/* Overall progress */}
        <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              stats.completionScore >= 80 ? "bg-emerald-500" : stats.completionScore >= 50 ? "bg-amber-500" : "bg-destructive",
            )}
            style={{ width: `${stats.completionScore}%` }}
          />
        </div>
      </div>

      {/* ═══ ACTION BUTTONS (tastoni) ═══ */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="grid grid-cols-4 gap-2">
          <ActionButton
            icon={Download}
            title="Profili mancanti"
            count={stats.noProfile}
            total={stats.total}
            onClick={() => onDownloadProfiles?.(countryCode)}
            disabled={!onDownloadProfiles}
          />
          <ActionButton
            icon={Search}
            title="Deep Search"
            count={stats.noDeep}
            total={stats.total}
            onClick={handleDeepSearchClick}
            disabled={!onDeepSearch}
            loading={deepSearching}
            loadingLabel={deepSearchProgress ? `${deepSearchProgress.current}/${deepSearchProgress.total}` : "..."}
          />
          <ActionButton
            icon={Tags}
            title="Alias azienda"
            count={stats.noCoAlias}
            total={stats.total}
            onClick={() => onGenerateAliases?.(countryCode, "company")}
            disabled={!onGenerateAliases}
            loading={aliasGenerating === "company"}
            loadingLabel="Generando..."
          />
          <ActionButton
            icon={UserCheck}
            title="Alias contatti"
            count={stats.noCtAlias}
            total={stats.total}
            onClick={() => onGenerateAliases?.(countryCode, "contact")}
            disabled={!onGenerateAliases}
            loading={aliasGenerating === "contact"}
            loadingLabel="Generando..."
          />
        </div>
      </div>

      {/* ═══ PROGRESS BARS ═══ */}
      <div className="px-2 py-1.5 border-b border-border/50 space-y-0.5">
        <ProgressRow label="Profili" value={stats.withProfile} total={stats.total} color="bg-emerald-500"
          onClick={() => toggleFilter("no_profile")} active={activeFilters.has("no_profile")} />
        <ProgressRow label="Deep S." value={stats.withDeep} total={stats.total} color="bg-sky-500"
          onClick={() => toggleFilter("no_deep_search")} active={activeFilters.has("no_deep_search")} />
        <ProgressRow label="Email" value={stats.withEmail} total={stats.total} color="bg-violet-500"
          onClick={() => toggleFilter("no_email")} active={activeFilters.has("no_email")} />
        <ProgressRow label="Telefono" value={stats.withPhone} total={stats.total} color="bg-amber-500"
          onClick={() => toggleFilter("no_phone")} active={activeFilters.has("no_phone")} />
        <ProgressRow label="Alias Az" value={stats.withCoAlias} total={stats.total} color="bg-teal-500" />
        <ProgressRow label="Alias Ct" value={stats.withCtAlias} total={stats.total} color="bg-pink-500" />
      </div>

      {/* ═══ FILTER CHIPS ═══ */}
      <div className="px-3 py-1.5 border-b border-border/50">
        <div className="flex flex-wrap items-center gap-1">
          {positiveFilters.map((f) => (
            <button key={f.key} onClick={() => toggleFilter(f.key)}
              className={cn("text-xs px-2 py-1 rounded-md border transition-all",
                activeFilters.has(f.key) ? "bg-primary/10 border-primary/30 text-primary font-medium" : "bg-muted border-border text-muted-foreground hover:bg-accent")}>
              {f.label} <span className="font-semibold ml-0.5">{f.count}</span>
            </button>
          ))}
          <span className="w-px h-4 bg-border mx-0.5" />
          {negativeFilters.map((f) => (
            <button key={f.key} onClick={() => toggleFilter(f.key)}
              className={cn("text-xs px-2 py-1 rounded-md border transition-all",
                activeFilters.has(f.key) ? "bg-destructive/10 border-destructive/30 text-destructive font-medium" : "bg-muted border-border text-muted-foreground hover:bg-accent")}>
              {f.label} <span className="font-semibold ml-0.5">{f.count}</span>
            </button>
          ))}
          {activeFilters.size > 0 && (
            <button onClick={() => setActiveFilters(new Set())}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-accent">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ═══ LIST HEADER ═══ */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-border/50">
        <span className="text-xs text-muted-foreground">{filteredPartners.length} partner</span>
        <button onClick={handleSelectAll}
          className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all",
            allSelected ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground hover:bg-accent")}>
          <CheckSquare className="w-3 h-3" />
          {allSelected ? "Deseleziona" : "Sel. tutti"}
        </button>
      </div>

      {/* ═══ PARTNER LIST ═══ */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {filteredPartners.map((partner: any) => {
            const pHasPhone = hasPhone(partner);
            const pHasEmail = hasEmail(partner);
            const pHasProfile = hasProfile(partner);
            const isSelected = selectedIds.has(partner.id);
            const contacts = partner.partner_contacts || [];

            return (
              <div key={partner.id} onClick={() => onSelectPartner(partner.id)}
                className={cn(
                  "px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-2.5",
                  "hover:bg-accent/50",
                  selectedId === partner.id && "bg-accent",
                  isSelected && "bg-primary/5",
                  !pHasProfile && "border-l-4 border-l-destructive",
                )}>
                <div onClick={(e) => { e.stopPropagation(); onToggleSelection(partner.id); }} className="shrink-0">
                  <Checkbox checked={isSelected} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{partner.company_name}</p>
                    {hasDeepSearch(partner) && (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="w-5 h-5 bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm shrink-0">D</span>
                        </TooltipTrigger>
                        <TooltipContent>Deep Search – {format(new Date((partner.enrichment_data as any).deep_search_at), "dd/MM/yyyy")}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{partner.city}</span>
                    {partner.rating > 0 && (
                      <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{Number(partner.rating).toFixed(1)}</span>
                    )}
                    <span className="text-[10px]">{contacts.length} cont.</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {pHasPhone && <Phone className="w-3.5 h-3.5 text-emerald-500" />}
                  {pHasEmail && <Mail className="w-3.5 h-3.5 text-sky-500" />}
                  {pHasProfile ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                </div>
              </div>
            );
          })}
          {filteredPartners.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">Nessun partner con questo filtro</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

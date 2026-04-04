import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInView } from "@/hooks/useInView";
import { SendEmailDialog } from "@/components/operations/SendEmailDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Phone, Mail, ChevronRight, Loader2,
  FileText, Trophy, Wand2, Send, Telescope, Building2, UserCircle,
  Zap, RefreshCw, CheckCircle2,
  Inbox, LayoutGrid, EyeOff,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { usePartnersPaginated } from "@/hooks/usePartnersPaginated";
import { useToggleFavorite } from "@/hooks/usePartners";
import { getCountryFlag, getYearsMember } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { t } from "@/components/download/theme";

import { MiniStars } from "@/components/partners/shared/MiniStars";
import { getRealLogoUrl } from "@/lib/partnerUtils";

import { usePartnerListStats } from "@/hooks/usePartnerListStats";
import { useWorkedToday } from "@/hooks/useWorkedToday";
import { IconIndicator, FilterActionBar } from "./partner-list/SubComponents";
import { PartnerVirtualList } from "./PartnerVirtualList";

/* ── Props ── */
interface PartnerListPanelProps {
  countryCodes: string[];
  countryNames: string[];
  isDark: boolean;
  onDeepSearch?: (partnerIds: string[]) => void;
  onGenerateAliases?: (countryCodes: string[], type: "company" | "contact") => void;
  deepSearchRunning?: boolean;
  aliasGenerating?: boolean;
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
  onSelectPartner?: (id: string | null) => void;
  selectedPartnerId?: string | null;
}

export function PartnerListPanel({
  countryCodes, countryNames, isDark,
  onDeepSearch, onGenerateAliases,
  deepSearchRunning, aliasGenerating,
  directoryOnly: directoryOnlyProp, onDirectoryOnlyChange,
  onSelectPartner, selectedPartnerId,
}: PartnerListPanelProps) {
  const th = t(isDark);
  const navigate = useNavigate();
  const countryCode = countryCodes[0] || "";
  const countryName = countryNames[0] || "";
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name_asc" | "rating_desc" | "contacts_desc">("name_asc");
  type ProgressFilterKey = "deep" | null;
  const [progressFilter, setProgressFilter] = useState<ProgressFilterKey>(null);
  const [emailTarget, setEmailTarget] = useState<{ email: string; name: string; company: string; partnerId: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hideWorked, setHideWorked] = useState(false);
  const { workedIds } = useWorkedToday();

  const {
    data: paginatedData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePartnersPaginated({
    countries: countryCodes,
    search: search.length >= 5 ? search : undefined,
  });

  const partners = useMemo(() => {
    if (!paginatedData) return [];
    return paginatedData.pages.flatMap(p => p.partners);
  }, [paginatedData]);

  const totalCount = paginatedData?.pages[0]?.total || 0;

  // Infinite scroll sentinel
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView();
  useEffect(() => {
    if (loadMoreInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [loadMoreInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleFavorite = useToggleFavorite();

  const { stats, verified, missingDeep } = usePartnerListStats({ countryCodes, partners });

  // ── Filtered & sorted partners ──
  const filteredPartners = useMemo(() => {
    let list = partners || [];
    if (hideWorked && workedIds.size > 0) {
      list = list.filter((p: any) => !workedIds.has(p.id));
    }
    if (progressFilter === "deep") {
      list = list.filter((p: any) => !(p.enrichment_data && (p.enrichment_data as any)?.deep_search_at));
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
  }, [partners, progressFilter, sortBy, hideWorked, workedIds]);

  const togglePartnerSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSendTo = useCallback(async (destination: "cockpit" | "workspace") => {
    if (selectedIds.size === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) { toast.error("Utente non autenticato"); return; }
    const partnerList = (partners || []).filter((p: any) => selectedIds.has(p.id));

    if (destination === "cockpit") {
      const items: { source_type: string; source_id: string; partner_id: string; user_id: string; status: string }[] = [];
      for (const p of partnerList as any[]) {
        const contacts = (p.partner_contacts || []) as any[];
        if (contacts.length > 0) {
          for (const c of contacts) {
            items.push({ source_type: "partner_contact", source_id: c.id, partner_id: p.id, user_id: userId, status: "queued" });
          }
        } else {
          items.push({ source_type: "partner_contact", source_id: p.id, partner_id: p.id, user_id: userId, status: "queued" });
        }
      }
      if (items.length > 0) {
        const { error } = await supabase.from("cockpit_queue").upsert(items as any, { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true });
        if (error) { toast.error("Errore: " + error.message); return; }
      }
      toast.success(`${partnerList.length} partner inviati a Cockpit`);
    } else {
      const inserts = partnerList.map((p: any) => {
        const contacts = p.partner_contacts || [];
        const primary = contacts.find((c: any) => c.is_primary) || contacts[0];
        return {
          activity_type: "send_email" as const,
          title: `Email a ${p.company_name}`,
          source_type: "partner",
          source_id: p.id,
          partner_id: p.id,
          selected_contact_id: primary?.id || null,
          status: "pending" as const,
          source_meta: {
            company_name: p.company_name,
            country_code: p.country_code,
            city: p.city,
            contact_name: primary?.name || null,
            contact_email: primary?.email || null,
          },
          user_id: userId,
        };
      });
      const { error } = await supabase.from("activities").insert(inserts as any);
      if (error) { toast.error("Errore: " + error.message); return; }
      toast.success(`${inserts.length} partner inviati a Workspace`);
    }
    setSelectedIds(new Set());
    const tab = destination === "cockpit" ? "cockpit" : "workspace";
    navigate(`/outreach?tab=${tab}`);
  }, [selectedIds, partners, navigate]);

  const handleSelectPartner = useCallback((id: string) => {
    if (onSelectPartner) onSelectPartner(id);
  }, [onSelectPartner]);

  // Auto-select first partner when list loads and nothing is selected
  useEffect(() => {
    if (!selectedPartnerId && filteredPartners.length > 0 && onSelectPartner) {
      onSelectPartner((filteredPartners[0] as any).id);
    }
  }, [filteredPartners, selectedPartnerId, onSelectPartner]);

  const toggleProgressFilter = (key: ProgressFilterKey) => {
    setProgressFilter(prev => prev === key ? null : key);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        {/* ═══ COMPACT HEADER ═══ */}
        <div className="px-3 pt-2.5 pb-1 flex-shrink-0 space-y-2">
          {/* ROW 1: Country + count + deep search filter */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {countryCodes.slice(0, 5).map(cc => (
                <span key={cc} className="text-lg leading-none">{getCountryFlag(cc)}</span>
              ))}
              {countryCodes.length > 5 && <span className={cn("text-[10px] font-bold ml-0.5", "text-muted-foreground")}>+{countryCodes.length - 5}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold truncate text-foreground">
                {countryCodes.length === 1 ? countryName : `${countryCodes.length} paesi`}
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground">
                {stats.total} partner
              </span>
            </div>
            {/* Deep Search filter only */}
            <IconIndicator icon={Telescope} count={stats.total - stats.withDeep} label="Senza Deep Search" isDark={isDark} onClick={() => toggleProgressFilter("deep")} active={progressFilter === "deep"} verified={verified.deep} />
          </div>

          {/* ROW 2: Search (icon+popover) + sort + count */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground">
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <Input
                  placeholder="Cerca partner (min 5 car.)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  className="h-8 text-xs"
                />
              </PopoverContent>
            </Popover>
            {search && (
              <span className="text-[10px] text-primary truncate max-w-[120px]">"{search}"</span>
            )}
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className={`w-[100px] h-7 rounded-lg text-[11px] ${th.selTrigger}`}><SelectValue /></SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="name_asc" className="text-xs">Nome A-Z</SelectItem>
                <SelectItem value="rating_desc" className="text-xs">Rating ↓</SelectItem>
                <SelectItem value="contacts_desc" className="text-xs">Contatti ↓</SelectItem>
              </SelectContent>
            </Select>
            <span className={cn("text-[10px] tabular-nums whitespace-nowrap ml-auto", th.dim)}>
              {isLoading ? "..." : `${filteredPartners.length}${progressFilter ? " filtrati" : ""}`}
            </span>
          </div>

          {/* Filter Action Bar (deep search only) */}
          {progressFilter && filteredPartners.length > 0 && (
            <FilterActionBar
              filter={progressFilter}
              count={filteredPartners.length}
              isDark={isDark}
              onDownload={() => {}}
              onDeepSearch={() => {
                const ids = filteredPartners.map((p: any) => p.id);
                if (ids.length > 0) onDeepSearch?.(ids);
              }}
              onGenerateAlias={(type) => onGenerateAliases?.(countryCodes, type)}
              deepSearchRunning={deepSearchRunning}
              aliasGenerating={aliasGenerating}
            />
          )}

          {/* ROW 3: Hide worked toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={hideWorked} onCheckedChange={setHideWorked} className="scale-75" />
            <span className="text-[10px] text-muted-foreground">
              <EyeOff className="w-3 h-3 inline mr-1" />Nascondi lavorati ({workedIds.size})
            </span>
          </div>

          {/* SELECTION ACTION BAR */}
          {selectedIds.size > 0 && (
            <div className={cn("flex items-center gap-2 p-2 rounded-lg border animate-in fade-in slide-in-from-top-2", "bg-primary/5 border-primary/20")}>
              <span className="text-xs font-bold text-primary">{selectedIds.size} selezionati</span>
              <div className="flex-1" />
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleSendTo("cockpit")}>
                <Inbox className="w-3 h-3" /> Cockpit
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleSendTo("workspace")}>
                <LayoutGrid className="w-3 h-3" /> Workspace
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setSelectedIds(new Set())}>
                ✕
              </Button>
            </div>
          )}
        </div>

        {/* ═══ PARTNER LIST (Virtualized) ═══ */}
        <PartnerVirtualList
          partners={filteredPartners}
          isLoading={isLoading}
          isDark={isDark}
          selectedPartnerId={selectedPartnerId}
          onSelect={handleSelectPartner}
          onEmailClick={(target) => setEmailTarget(target)}
          selectedIds={selectedIds}
          onToggleSelect={togglePartnerSelect}
        />
      </div>
      {emailTarget && (
        <SendEmailDialog open={!!emailTarget} onOpenChange={(open) => { if (!open) setEmailTarget(null); }}
          recipientEmail={emailTarget.email} recipientName={emailTarget.name} companyName={emailTarget.company} partnerId={emailTarget.partnerId} isDark={isDark} />
      )}
    </TooltipProvider>
  );
}

import { useState, useMemo, useEffect, lazy, Suspense, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  SlidersHorizontal, Search, RotateCcw, Check, ArrowUpDown,
  Shield, Database, Filter, Layers, Users, Sparkles, Wifi,
  Plane, Mail, Phone, MessageCircle, Linkedin, Tag,
  ListTodo, Clock, CheckCircle2, AlertTriangle, Zap, Globe, RefreshCw,
} from "lucide-react";
import { FilterDropdownMulti, type FilterOption } from "@/components/global/FilterDropdownMulti";
import { capitalizeFirst } from "@/lib/capitalize";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useCountryStats } from "@/hooks/useCountryStats";
import { getCountryFlag, resolveCountryCode } from "@/lib/countries";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { EmailComposerContactPicker } from "@/components/global/EmailComposerContactPicker";
import {
  COCKPIT_SORT, COCKPIT_ORIGIN, COCKPIT_CHANNEL, COCKPIT_QUALITY, COCKPIT_STATUS,
  FLAG, ATTIVITA_STATUS, ATTIVITA_PRIORITY, EMAIL_CATEGORIES, EMAIL_SORT,
  WS_CHIPS, EMAIL_GEN, SORTING_FILTERS, NETWORK_SORT, NETWORK_QUALITY,
  CRM_GROUPBY, CRM_SORT, CRM_ORIGIN, CRM_LEAD_STATUS, CRM_HOLDING, CRM_QUALITY, CRM_CHANNEL,
} from "@/components/global/filters-drawer/constants";
import { FilterSection, ChipGroup, Chip } from "@/components/global/filters-drawer/shared";

interface FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Main Component ── */

export function FiltersDrawer({ open, onOpenChange }: FiltersDrawerProps) {
  const g = useGlobalFilters();
  const location = useLocation();
  const [drawerWidth, setDrawerWidth] = useState<number | null>(null);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const w = Math.max(320, Math.min(ev.clientX, window.innerWidth * 0.8));
      setDrawerWidth(w);
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const resizeRef = useRef<HTMLDivElement>(null);

  const route = location.pathname;
  const isOutreach = route === "/outreach";
  const isNetwork = route === "/network";
  const isCRM = route === "/crm";
  const isAgenda = route === "/agenda";
  const isEmailComposer = route === "/email-composer";

  // Detect outreach sub-tab
  const outreachTab = g.filters.outreachTab;
  const isCockpit = isOutreach && outreachTab === "cockpit";
  const isWorkspace = isOutreach && outreachTab === "workspace";
  const isInUscita = isOutreach && outreachTab === "inuscita";
  const isCircuito = isOutreach && outreachTab === "circuito";
  const isAttivita = isOutreach && outreachTab === "attivita";
  const isEmail = isOutreach && outreachTab === "email";
  const isWhatsApp = isOutreach && outreachTab === "whatsapp";
  const isLinkedIn = isOutreach && outreachTab === "linkedin";
  const isInbox = isEmail || isWhatsApp || isLinkedIn;

  const { contacts } = useCockpitContacts();

  const countryStats = useMemo(() => {
    if (!isCockpit || !contacts.length) return [];
    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      const cc = (c as any).country?.toUpperCase() || "??";
      counts[cc] = (counts[cc] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count, flag: FLAG[code] || "🌍" }));
  }, [contacts, isCockpit]);

  // Context title
  const sectionTitle = isCockpit ? "Cockpit" : isWorkspace ? "Workspace" : isInUscita ? "In Uscita" : isCircuito ? "Circuito" : isAttivita ? "Attività" : isEmail ? "Email" : isWhatsApp ? "WhatsApp" : isLinkedIn ? "LinkedIn" : isNetwork ? "Network" : isCRM ? (g.filters.crmActiveTab === "biglietti" ? "Biglietti da visita" : "CRM Contatti") : isAgenda ? "Agenda" : isEmailComposer ? "Email Composer" : "Globale";

  // Listen for close event from sub-components (e.g. search result click)
  useEffect(() => {
    const handler = () => onOpenChange(false);
    window.addEventListener("filters-drawer-close", handler);
    return () => window.removeEventListener("filters-drawer-close", handler);
  }, [onOpenChange]);

  // Active filter count
  const activeCount = useMemo(() => {
    let n = 0;
    if (isCockpit) {
      if (g.filters.cockpitCountries.size) n++;
      if (g.filters.cockpitChannels.size) n++;
      if (g.filters.cockpitQuality.size) n++;
      if (g.filters.cockpitStatus !== "all") n++;
      if (g.filters.sortBy !== "name") n++;
      if (g.filters.origin.size < 4) n++;
    }
    if (isAttivita) {
      if (g.filters.attivitaStatus !== "all") n++;
      if (g.filters.attivitaPriority !== "all") n++;
    }
    if (isEmail) {
      if (g.filters.emailCategory !== "all") n++;
      if (g.filters.sortingFilter !== "all") n++;
    }
    if (isNetwork) {
      if (g.filters.networkSearch.trim()) n++;
      if (g.filters.networkQuality !== "all") n++;
      if (g.filters.networkSort !== "name") n++;
      if (g.filters.networkSelectedCountries.size > 0) n++;
    }
    if (isCRM) {
      if (g.filters.leadStatus !== "all") n++;
      if (g.filters.holdingPattern !== "out") n++;
      if (g.filters.crmQuality !== "all") n++;
      if (g.filters.crmChannel !== "all") n++;
    }
    return n;
  }, [g.filters, isCockpit, isAttivita, isEmail, isNetwork, isCRM]);

  const handleResetAll = () => {
    if (isCockpit) {
      g.setCockpitCountries(new Set());
      g.setCockpitChannels(new Set());
      g.setCockpitQuality(new Set());
      g.setCockpitStatus("all");
      g.setSortBy("name");
      g.setOrigin(new Set(["wca", "import", "report_aziende", "bca"]));
      g.setSearch("");
    }
    if (isAttivita) {
      g.setAttivitaStatus("all");
      g.setAttivitaPriority("all");
      g.setSearch("");
    }
    if (isEmail || isWhatsApp || isLinkedIn) {
      g.setSortingFilter("all");
      g.setEmailCategory("all");
      g.setEmailSort("date_desc");
      g.setSortBy("date_desc");
      g.setSortingSearch("");
    }
    if (isWorkspace) {
      g.setWorkspaceFilters(new Set());
      g.setEmailGenFilter("all");
      g.setSearch("");
    }
    if (isInUscita) {
      g.setSortingFilter("all");
      g.setSortingSearch("");
    }
    if (isNetwork) {
      g.setNetworkSearch("");
      g.setNetworkQuality("all");
      g.setNetworkSort("name");
      g.setNetworkSelectedCountries(new Set());
      g.setNetworkDirectoryOnly(false);
    }
    if (isCRM) {
      g.setSearch("");
      g.setLeadStatus("all");
      g.setHoldingPattern("out");
      g.setCrmQuality("all");
      g.setCrmChannel("all");
      g.setGroupBy("country");
      g.setSortBy("name");
    }
  };

  // Toggle helpers
  const toggleOrigin = (val: string) => {
    const next = new Set(g.filters.origin);
    if (next.has(val)) { if (next.size > 1) next.delete(val); } else next.add(val);
    g.setOrigin(next);
  };

  const toggleCockpitCountry = (code: string) => {
    const next = new Set(g.filters.cockpitCountries);
    if (next.has(code)) next.delete(code); else next.add(code);
    g.setCockpitCountries(next);
  };

  const toggleCockpitChannel = (key: CockpitChannelFilter) => {
    const next = new Set(g.filters.cockpitChannels);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setCockpitChannels(next);
  };

  const toggleCockpitQuality = (key: CockpitQualityFilter) => {
    const next = new Set(g.filters.cockpitQuality);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setCockpitQuality(next);
  };

  const toggleWs = (key: WorkspaceFilterKey) => {
    const next = new Set(g.filters.workspaceFilters);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setWorkspaceFilters(next);
  };

  const toggleCrmOrigin = (o: string) => {
    const next = new Set(g.filters.crmOrigin);
    if (next.has(o)) { if (next.size > 1) next.delete(o); } else next.add(o);
    g.setCrmOrigin(next);
  };

  const defaultWidthClass = isEmailComposer ? "w-[92vw] sm:w-[560px] sm:max-w-[620px]" : "w-[90vw] sm:w-[400px] sm:max-w-[420px]";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className={cn("p-0 flex flex-col border-r border-primary/10 backdrop-blur-xl", !drawerWidth && defaultWidthClass)} style={{ ...(drawerWidth ? { width: drawerWidth, maxWidth: "80vw" } : {}), background: "linear-gradient(to right, hsl(0 0% 0%) 0%, hsl(0 0% 0%) 20%, hsl(var(--background)) 40%)" }}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-border/50 bg-gradient-to-r from-transparent to-primary/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Filtri</h3>
              <p className="text-[11px] text-muted-foreground">{sectionTitle}</p>
            </div>
            {activeCount > 0 && (
              <span className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-semibold">{activeCount}</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* ═══ OUTREACH / COCKPIT ═══ */}
          {isCockpit && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca contatto, azienda..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>

              <FilterSection icon={ArrowUpDown} label="Ordina">
                <ChipGroup>
                  {COCKPIT_SORT.map(o => <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>

              <FilterSection icon={Database} label="Origine">
                <ChipGroup>
                  {COCKPIT_ORIGIN.map(o => <Chip key={o.value} active={g.filters.origin.has(o.value)} onClick={() => toggleOrigin(o.value)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>

              {countryStats.length > 0 && (
                <FilterSection icon={Filter} label="Paese">
                  <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
                    {countryStats.slice(0, 24).map(({ code, count, flag }) => (
                      <Chip key={code} active={g.filters.cockpitCountries.has(code)} onClick={() => toggleCockpitCountry(code)}>
                        {flag} {code} <Badge variant="secondary" className="text-[8px] h-3 px-1 ml-0.5">{count}</Badge>
                      </Chip>
                    ))}
                  </div>
                </FilterSection>
              )}

              <FilterSection icon={Wifi} label="Canale">
                <ChipGroup>
                  {COCKPIT_CHANNEL.map(o => <Chip key={o.key} active={g.filters.cockpitChannels.has(o.key)} onClick={() => toggleCockpitChannel(o.key)}>{o.icon} {o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>

              <FilterSection icon={Sparkles} label="Qualità">
                <ChipGroup>
                  {COCKPIT_QUALITY.map(o => <Chip key={o.key} active={g.filters.cockpitQuality.has(o.key)} onClick={() => toggleCockpitQuality(o.key)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>

              <FilterSection icon={Plane} label="Stato lead">
                <ChipGroup>
                  {COCKPIT_STATUS.map(o => <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>
            </>
          )}

          {/* ═══ OUTREACH / ATTIVITÀ ═══ */}
          {isAttivita && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca attività..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={ListTodo} label="Stato">
                <ChipGroup>
                  {ATTIVITA_STATUS.map(o => <Chip key={o.value} active={g.filters.attivitaStatus === o.value} onClick={() => g.setAttivitaStatus(o.value)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>
              <FilterSection icon={Zap} label="Priorità">
                <ChipGroup>
                  {ATTIVITA_PRIORITY.map(o => <Chip key={o.value} active={g.filters.attivitaPriority === o.value} onClick={() => g.setAttivitaPriority(o.value)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>
              <FilterSection icon={ArrowUpDown} label="Ordina">
                <ChipGroup>
                  {[{ value: "date_desc", label: "Più recenti" }, { value: "date_asc", label: "Più vecchi" }, { value: "priority", label: "Priorità" }].map(o => (
                    <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
                  ))}
                </ChipGroup>
              </FilterSection>
            </>
          )}

          {/* ═══ OUTREACH / WORKSPACE ═══ */}
          {isWorkspace && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={Mail} label="Stato email">
                <ChipGroup>
                  {EMAIL_GEN.map(o => <Chip key={o.key} active={g.filters.emailGenFilter === o.key} onClick={() => g.setEmailGenFilter(o.key)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>
              <FilterSection icon={Users} label="Contatti">
                <ChipGroup>
                  {WS_CHIPS.map(o => <Chip key={o.key} active={g.filters.workspaceFilters.has(o.key)} onClick={() => toggleWs(o.key)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>
            </>
          )}

          {/* ═══ OUTREACH / IN USCITA ═══ */}
          {isInUscita && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.sortingSearch} onChange={e => g.setSortingSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={Layers} label="Stato coda">
                <ChipGroup>
                  {SORTING_FILTERS.map(o => <Chip key={o.key} active={g.filters.sortingFilter === o.key} onClick={() => g.setSortingFilter(o.key)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>
            </>
          )}

          {/* ═══ OUTREACH / CIRCUITO ═══ */}
          {isCircuito && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={Plane} label="Fase">
                <ChipGroup>
                  {COCKPIT_STATUS.map(o => <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>
              <FilterSection icon={ArrowUpDown} label="Ordina">
                <ChipGroup>
                  {[{ value: "name", label: "Nome" }, { value: "lastContact", label: "Ultimo contatto" }, { value: "company", label: "Azienda" }].map(o => (
                    <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
                  ))}
                </ChipGroup>
              </FilterSection>
            </>
          )}

          {/* ═══ OUTREACH / INBOX (Email, WhatsApp, LinkedIn) ═══ */}
          {isInbox && (
            <InboxFiltersSection
              channel={isEmail ? "email" : isWhatsApp ? "whatsapp" : "linkedin"}
              channelIcon={isEmail ? Mail : isWhatsApp ? MessageCircle : Linkedin}
            />
          )}

          {isNetwork && (
            <NetworkFiltersSection />
          )}

          {/* ═══ CRM ═══ */}
          {isCRM && g.filters.crmActiveTab === "contatti" && (
            <CRMFiltersSection />
          )}
          {isCRM && g.filters.crmActiveTab === "biglietti" && (
            <BCAFiltersSection />
          )}

          {/* ═══ AGENDA ═══ */}
          {isAgenda && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca attività, evento..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={ListTodo} label="Tipo">
                <ChipGroup>
                  {[{ value: "all", label: "Tutti" }, { value: "reminder", label: "Promemoria" }, { value: "activity", label: "Attività" }, { value: "followup", label: "Follow-up" }].map(o => (
                    <Chip key={o.value} active={g.filters.attivitaStatus === o.value} onClick={() => g.setAttivitaStatus(o.value)}>{o.label}</Chip>
                  ))}
                </ChipGroup>
              </FilterSection>
              <FilterSection icon={Zap} label="Priorità">
                <ChipGroup>
                  {ATTIVITA_PRIORITY.map(o => <Chip key={o.value} active={g.filters.attivitaPriority === o.value} onClick={() => g.setAttivitaPriority(o.value)}>{o.label}</Chip>)}
                </ChipGroup>
              </FilterSection>
              <FilterSection icon={ArrowUpDown} label="Ordina">
                <ChipGroup>
                  {[{ value: "date_desc", label: "Più recenti" }, { value: "date_asc", label: "Più vecchi" }, { value: "priority", label: "Priorità" }].map(o => (
                    <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
                  ))}
                </ChipGroup>
              </FilterSection>
            </>
          )}

          {/* ═══ EMAIL COMPOSER — Rubrica ═══ */}
          {isEmailComposer && <EmailComposerContactPicker onConfirm={() => onOpenChange(false)} />}

          {/* Fallback for pages without specific filters */}
          {!isOutreach && !isNetwork && !isCRM && !isAgenda && !isEmailComposer && (
            <div className="text-center py-8 text-muted-foreground">
              <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nessun filtro per questa sezione</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/50 bg-muted/20 flex gap-2">
          <Button variant="outline" className="flex-1 h-9 gap-2 text-xs" onClick={handleResetAll} disabled={activeCount === 0}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset ({activeCount})
          </Button>
          <Button className="flex-1 h-9 gap-2 text-xs" onClick={() => onOpenChange(false)}>
            <Check className="w-3.5 h-3.5" /> Conferma
          </Button>
        </div>
        {/* Resize handle */}
        <div
          ref={resizeRef}
          onMouseDown={startResize}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50"
        />
      </SheetContent>
    </Sheet>
  );
}

/* ── CRM Filters with Country List (aligned to Network) ── */

function CRMFiltersSection() {
  const g = useGlobalFilters();
  const [countrySearch, setCountrySearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [crmCountries, setCrmCountries] = useState<{ value: string; name: string; flag: string; total: number }[]>([]);
  const [crmOrigins, setCrmOrigins] = useState<FilterOption[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const pageSize = 1000;

        // Fetch all countries + origins in one pass
        const allRows: any[] = [];
        let from = 0;
        while (true) {
          const { data: page, error } = await supabase
            .from("imported_contacts")
            .select("country, origin")
            .range(from, from + pageSize - 1);
          if (error || !page || page.length === 0) break;
          allRows.push(...page);
          if (page.length < pageSize) break;
          from += pageSize;
        }

        // Countries
        const countryCounts: Record<string, number> = {};
        const originCounts: Record<string, number> = {};
        allRows.forEach((r: any) => {
          const raw = (r.country || "").trim();
          if (raw) countryCounts[raw] = (countryCounts[raw] || 0) + 1;
          const o = (r.origin || "").trim();
          if (o) originCounts[o] = (originCounts[o] || 0) + 1;
        });

        setCrmCountries(
          Object.entries(countryCounts)
            .map(([value, total]) => {
              const resolved = resolveCountryCode(value);
              const wcaCountry = resolved ? WCA_COUNTRIES.find((c: any) => c.code === resolved) : null;
              return { value, name: wcaCountry?.name || value, flag: resolved ? getCountryFlag(resolved) : "", total };
            })
            .sort((a, b) => b.total - a.total)
        );

        setCrmOrigins(
          Object.entries(originCounts)
            .map(([value, count]) => ({ value, label: capitalizeFirst(value), count }))
            .sort((a, b) => (b.count || 0) - (a.count || 0))
        );
      } catch { /* intentionally ignored: best-effort cleanup */ }
    };
    fetchData();
  }, []);

  const selectedCountries = useMemo(
    () => crmCountries.filter((c) => g.filters.crmSelectedCountries.has(c.value)),
    [crmCountries, g.filters.crmSelectedCountries]
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    const matches = !q
      ? crmCountries
      : crmCountries.filter(c => c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q));
    return [...matches].sort((a, b) => {
      const aS = g.filters.crmSelectedCountries.has(a.value) ? 1 : 0;
      const bS = g.filters.crmSelectedCountries.has(b.value) ? 1 : 0;
      if (aS !== bS) return bS - aS;
      return b.total - a.total;
    });
  }, [crmCountries, countrySearch, g.filters.crmSelectedCountries]);

  const toggleCountry = (value: string) => {
    const next = new Set(g.filters.crmSelectedCountries);
    if (next.has(value)) next.delete(value); else next.add(value);
    g.setCrmSelectedCountries(next);
  };

  const toggleCrmOrigin = (val: string) => {
    const next = new Set(g.filters.crmOrigin);
    if (next.has(val)) next.delete(val); else next.add(val);
    g.setCrmOrigin(next);
  };

  const toggleLeadStatus = (val: string) => {
    if (val === g.filters.leadStatus) g.setLeadStatus("all");
    else g.setLeadStatus(val);
  };

  const toggleHolding = (val: string) => {
    if (val === g.filters.holdingPattern) g.setHoldingPattern("all");
    else g.setHoldingPattern(val);
  };

  const toggleChannel = (val: string) => {
    if (val === g.filters.crmChannel) g.setCrmChannel("all");
    else g.setCrmChannel(val);
  };

  const toggleQuality = (val: string) => {
    if (val === g.filters.crmQuality) g.setCrmQuality("all");
    else g.setCrmQuality(val);
  };

  // Search
  const searchValue = g.filters.search;
  useEffect(() => {
    if (searchValue.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const doSearch = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("imported_contacts")
          .select("id, name, company_name, company_alias, country, email, position")
          .or(`name.ilike.%${searchValue}%,company_name.ilike.%${searchValue}%,company_alias.ilike.%${searchValue}%,email.ilike.%${searchValue}%`)
          .limit(30);
        setSearchResults(data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    };
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Build filter options for dropdowns
  const statusOptions: FilterOption[] = [
    { value: "new", label: "Nuovo" },
    { value: "contacted", label: "Contattato" },
    { value: "qualified", label: "Qualificato" },
    { value: "converted", label: "Convertito" },
  ];

  const holdingOptions: FilterOption[] = [
    { value: "out", label: "Fuori circuito" },
    { value: "in", label: "In circuito" },
  ];

  const channelOptions: FilterOption[] = [
    { value: "with_email", label: "📧 Email" },
    { value: "with_phone", label: "📱 Telefono" },
    { value: "with_linkedin", label: "🔗 LinkedIn" },
    { value: "with_whatsapp", label: "💬 WhatsApp" },
  ];

  const qualityOptions: FilterOption[] = [
    { value: "enriched", label: "Arricchiti" },
    { value: "not_enriched", label: "Non arricchiti" },
    { value: "with_alias", label: "Con alias" },
    { value: "no_alias", label: "Senza alias" },
  ];

  const selectedStatus = new Set(g.filters.leadStatus !== "all" ? [g.filters.leadStatus] : []);
  const selectedHolding = new Set(g.filters.holdingPattern !== "all" ? [g.filters.holdingPattern] : []);
  const selectedChannel = new Set(g.filters.crmChannel !== "all" ? [g.filters.crmChannel] : []);
  const selectedQuality = new Set(g.filters.crmQuality !== "all" ? [g.filters.crmQuality] : []);

  return (
    <>
      {/* Search */}
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Contatto, azienda, email..." className="h-8 text-xs bg-muted/30 border-border/40" />
        {searchValue.trim().length >= 2 && (
          <div className="mt-2 max-h-[250px] overflow-y-auto rounded-lg border border-border/40 bg-muted/10 divide-y divide-border/20">
            {searching ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Ricerca in corso...</div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Nessun risultato per "{searchValue}"</div>
            ) : (
              <>
                <div className="px-2.5 py-1.5 bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground">{searchResults.length} risultati</span>
                </div>
                {searchResults.map((c: any) => {
                  const resolvedCountry = resolveCountryCode(c.country || "");
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("crm-select-contact", { detail: { contactId: c.id } }));
                        window.dispatchEvent(new CustomEvent("filters-drawer-close"));
                      }}
                      className="w-full text-left px-2.5 py-2 hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm shrink-0 w-4 text-center">{resolvedCountry ? getCountryFlag(resolvedCountry) : ""}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{c.company_alias || c.company_name || "—"}</p>
                          {c.name && <p className="text-[10px] text-muted-foreground truncate">{c.name}{c.position ? ` · ${c.position}` : ""}</p>}
                        </div>
                        {c.email && <span className="text-[9px] text-muted-foreground truncate max-w-[110px]">{c.email}</span>}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </FilterSection>

      {/* Raggruppa per */}
      <FilterSection icon={Layers} label="Raggruppa per">
        <ChipGroup>
          {CRM_GROUPBY.map(o => (
            <Chip key={o.value} active={g.filters.groupBy === o.value} onClick={() => g.setGroupBy(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Dropdown filters — compact */}
      <div className="space-y-1.5">
        <FilterDropdownMulti
          label="Origine"
          icon={Database}
          options={crmOrigins}
          selected={g.filters.crmOrigin}
          onToggle={toggleCrmOrigin}
          searchable
          placeholder="Cerca origine..."
        />

        <FilterDropdownMulti
          label="Stato"
          icon={Users}
          options={statusOptions}
          selected={selectedStatus}
          onToggle={toggleLeadStatus}
          singleSelect
          capitalize={false}
        />

        <FilterDropdownMulti
          label="Circuito"
          icon={Plane}
          options={holdingOptions}
          selected={selectedHolding}
          onToggle={toggleHolding}
          singleSelect
          capitalize={false}
          activeColor={g.filters.holdingPattern === "in" ? "danger" : g.filters.holdingPattern === "out" ? "info" : "default"}
        />

        <FilterDropdownMulti
          label="Canale"
          icon={Wifi}
          options={channelOptions}
          selected={selectedChannel}
          onToggle={toggleChannel}
          singleSelect
          capitalize={false}
        />

        <FilterDropdownMulti
          label="Qualità"
          icon={Sparkles}
          options={qualityOptions}
          selected={selectedQuality}
          onToggle={toggleQuality}
          singleSelect
          capitalize={false}
        />
      </div>

      {/* WCA Match filter */}
      <FilterSection icon={Shield} label="Match WCA">
        <ChipGroup>
          {[
            { value: "all", label: "Tutti" },
            { value: "matched", label: "Matchati" },
            { value: "unmatched", label: "Non matchati" },
          ].map(o => (
            <Chip key={o.value} active={g.filters.crmWcaMatch === o.value} onClick={() => g.setCrmWcaMatch(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Countries — identical to Network */}
      <FilterSection icon={Globe} label={`Paesi (${g.filters.crmSelectedCountries.size > 0 ? g.filters.crmSelectedCountries.size + ' sel.' : 'tutti'})`}>
        {selectedCountries.length > 0 && (
          <div className="mb-1.5 rounded-lg border border-primary/20 bg-primary/5 p-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-primary">Paesi attivi</span>
              <button onClick={() => g.setCrmSelectedCountries(new Set())} className="text-[9px] text-destructive hover:underline">Reset</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedCountries.map(c => (
                <button key={c.value} onClick={() => toggleCountry(c.value)} className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                  {c.flag} {c.name} ×
                </button>
              ))}
            </div>
          </div>
        )}
        <Input value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Cerca paese..." className="h-7 text-xs bg-muted/30 border-border/40 mb-1.5" />
        <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border/40 bg-muted/10 p-1">
          {filteredCountries.map(c => (
            <button
              key={c.value}
              onClick={() => toggleCountry(c.value)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all",
                g.filters.crmSelectedCountries.has(c.value) ? "bg-primary/15 text-primary" : "hover:bg-muted/40"
              )}
            >
              <span className="text-sm">{c.flag}</span>
              <span className="flex-1 text-left truncate font-medium">{c.name}</span>
              {g.filters.crmSelectedCountries.has(c.value) && <Check className="w-3 h-3 text-primary" />}
              <span className="text-[9px] tabular-nums opacity-60">{c.total}</span>
            </button>
          ))}
          {filteredCountries.length === 0 && <div className="px-2 py-3 text-[10px] text-muted-foreground text-center">Nessun paese trovato</div>}
        </div>
      </FilterSection>
    </>
  );
}

/* ── Network Filters with Country List ── */

function NetworkFiltersSection() {
  const g = useGlobalFilters();
  const { data: statsData } = useCountryStats();
  const [countrySearch, setCountrySearch] = useState("");

  // Inline search results from DB
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const countries = useMemo(() => {
    if (!statsData?.byCountry) return [];
    return Object.values(statsData.byCountry).map((s: any) => {
      const wcaCountry = WCA_COUNTRIES.find((c: any) => c.code === s.country_code);
      return {
        code: s.country_code,
        name: wcaCountry?.name || s.country_code,
        flag: getCountryFlag(s.country_code),
        total: s.total_partners || 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [statsData]);

  const selectedCountries = useMemo(
    () => countries.filter((country) => g.filters.networkSelectedCountries.has(country.code)),
    [countries, g.filters.networkSelectedCountries]
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    const matches = !q
      ? countries
      : countries.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));

    return [...matches].sort((a, b) => {
      const aSelected = g.filters.networkSelectedCountries.has(a.code) ? 1 : 0;
      const bSelected = g.filters.networkSelectedCountries.has(b.code) ? 1 : 0;
      if (aSelected !== bSelected) return bSelected - aSelected;
      return b.total - a.total;
    });
  }, [countries, countrySearch, g.filters.networkSelectedCountries]);

  const toggleCountry = (code: string) => {
    const next = new Set(g.filters.networkSelectedCountries);
    if (next.has(code)) next.delete(code); else next.add(code);
    g.setNetworkSelectedCountries(next);
  };

  // Live search for partners (like email composer picker)
  const networkSearchValue = g.filters.networkSearch;
  useEffect(() => {
    if (networkSearchValue.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const doSearch = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("partners")
          .select("id, company_name, company_alias, country_code, city, email, partner_contacts(id, name, email, contact_alias, title)")
          .or(`company_name.ilike.%${networkSearchValue}%,company_alias.ilike.%${networkSearchValue}%,email.ilike.%${networkSearchValue}%`)
          .eq("is_active", true)
          .limit(30);
        setSearchResults(data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    };
    const timer = setTimeout(doSearch, 300); // debounce
    return () => clearTimeout(timer);
  }, [networkSearchValue]);

  const handleSyncWca = () => {
    window.dispatchEvent(new CustomEvent("sync-wca-trigger"));
  };

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.networkSearch} onChange={e => g.setNetworkSearch(e.target.value)} placeholder="Partner, azienda, email..." className="h-8 text-xs bg-muted/30 border-border/40" />
        {/* Inline search results */}
        {networkSearchValue.trim().length >= 2 && (
          <div className="mt-2 max-h-[300px] overflow-y-auto rounded-lg border border-border/40 bg-muted/10 divide-y divide-border/20">
            {searching ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Ricerca in corso...</div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">Nessun risultato per "{networkSearchValue}"</div>
            ) : (
              <>
                <div className="px-2.5 py-1.5 bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground">{searchResults.length} risultati</span>
                </div>
                {searchResults.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      // Dispatch event to select partner in list, set search to exact name, close drawer
                      window.dispatchEvent(new CustomEvent("network-select-partner", { detail: { partnerId: p.id } }));
                      g.setNetworkSearch(p.company_name);
                      window.dispatchEvent(new CustomEvent("filters-drawer-close"));
                    }}
                    className="w-full text-left px-2.5 py-2 hover:bg-primary/10 transition-colors cursor-pointer rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm shrink-0">{getCountryFlag(p.country_code)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.company_alias || p.company_name}</p>
                        {p.city && <p className="text-[10px] text-muted-foreground">{p.city}</p>}
                      </div>
                      {p.email && <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{p.email}</span>}
                    </div>
                    {/* Show contacts */}
                    {Array.isArray(p.partner_contacts) && p.partner_contacts.length > 0 && (
                      <div className="mt-1 ml-6 space-y-0.5">
                        {p.partner_contacts.slice(0, 3).map((c: any) => (
                          <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Users className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{c.contact_alias || c.name}</span>
                            {c.title && <span className="text-[9px] opacity-60 truncate">· {c.title}</span>}
                            {c.email && <span className="text-[9px] text-primary/70 truncate ml-auto">{c.email}</span>}
                          </div>
                        ))}
                        {p.partner_contacts.length > 3 && (
                          <span className="text-[9px] text-muted-foreground/60">+{p.partner_contacts.length - 3} altri</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </FilterSection>


      <FilterSection icon={Globe} label={`Paesi (${g.filters.networkSelectedCountries.size > 0 ? g.filters.networkSelectedCountries.size + ' selezionati' : 'tutti'})`}>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Clicca i paesi da includere nella lista partner.
        </p>
        {selectedCountries.length > 0 && (
          <div className="mb-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-primary">Paesi attivi</span>
              <button
                onClick={() => g.setNetworkSelectedCountries(new Set())}
                className="text-[10px] text-destructive hover:underline"
              >
                Deseleziona tutti
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedCountries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => toggleCountry(country.code)}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary"
                >
                  <span>{country.flag}</span>
                  <span>{country.code}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Input
          value={countrySearch}
          onChange={e => setCountrySearch(e.target.value)}
          placeholder="Cerca paese..."
          className="h-7 text-xs bg-muted/30 border-border/40 mb-1.5"
        />
        <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border/40 bg-muted/10 p-1 pr-2">
          <div className="space-y-0.5">
            {filteredCountries.map(c => (
              <button
                key={c.code}
                onClick={() => toggleCountry(c.code)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all",
                  g.filters.networkSelectedCountries.has(c.code)
                    ? "bg-primary/15 border border-primary/30 text-primary"
                    : "hover:bg-muted/40 text-foreground"
                )}
              >
                <span className="text-base">{c.flag}</span>
                <span className="flex-1 text-left truncate font-medium">{c.name}</span>
                {g.filters.networkSelectedCountries.has(c.code) && <Check className="w-3 h-3 text-primary" />}
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 tabular-nums">{c.total}</Badge>
              </button>
            ))}
            {filteredCountries.length === 0 && (
              <div className="px-2 py-3 text-[11px] text-muted-foreground">
                Nessun paese trovato.
              </div>
            )}
          </div>
        </div>
      </FilterSection>

      <FilterSection icon={Sparkles} label="Qualità dati">
        <ChipGroup>
          {NETWORK_QUALITY.map(o => <Chip key={o.value} active={g.filters.networkQuality === o.value} onClick={() => g.setNetworkQuality(o.value)}>{o.label}</Chip>)}
        </ChipGroup>
      </FilterSection>

      <FilterSection icon={RefreshCw} label="Azioni">
        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-2" onClick={handleSyncWca}>
          <RefreshCw className="w-3 h-3" /> Sincronizza WCA
        </Button>
      </FilterSection>
    </>
  );
}

/* ── Shared Inbox Filters (Email/WA/LinkedIn) ── */

function InboxFiltersSection({ channel, channelIcon: ChannelIcon }: { channel: "email" | "whatsapp" | "linkedin"; channelIcon: any }) {
  const g = useGlobalFilters();
  const isEmail = channel === "email";
  const channelLabel = isEmail ? "Email" : channel === "whatsapp" ? "WhatsApp" : "LinkedIn";

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.sortingSearch} onChange={e => g.setSortingSearch(e.target.value)} placeholder={`Cerca in ${channelLabel}...`} className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={ChannelIcon} label="Stato">
        <ChipGroup>
          <Chip active={g.filters.sortingFilter === "all"} onClick={() => g.setSortingFilter("all")}>Tutti</Chip>
          <Chip active={g.filters.sortingFilter === "unreviewed"} onClick={() => g.setSortingFilter("unreviewed")}>Non letti</Chip>
          <Chip active={g.filters.sortingFilter === "reviewed"} onClick={() => g.setSortingFilter("reviewed")}>Letti</Chip>
        </ChipGroup>
      </FilterSection>
      {isEmail && (
        <FilterSection icon={Tag} label="Categoria">
          <ChipGroup>
            {EMAIL_CATEGORIES.map(o => <Chip key={o.value} active={g.filters.emailCategory === o.value} onClick={() => g.setEmailCategory(o.value)}>{o.label}</Chip>)}
          </ChipGroup>
        </FilterSection>
      )}
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {isEmail ? (
            EMAIL_SORT.map(o => <Chip key={o.value} active={g.filters.emailSort === o.value} onClick={() => g.setEmailSort(o.value)}>{o.label}</Chip>)
          ) : (
            <>
              <Chip active={g.filters.sortBy === "date_desc"} onClick={() => g.setSortBy("date_desc")}>Più recenti</Chip>
              <Chip active={g.filters.sortBy === "date_asc"} onClick={() => g.setSortBy("date_asc")}>Più vecchi</Chip>
              <Chip active={g.filters.sortBy === "unread"} onClick={() => g.setSortBy("unread")}>Non letti prima</Chip>
            </>
          )}
        </ChipGroup>
      </FilterSection>
    </>
  );
}



/* ── BCA Filters Section (for Biglietti tab) ── */

function BCAFiltersSection() {
  const g = useGlobalFilters();
  const [bcaEvents, setBcaEvents] = useState<{ name: string; count: number }[]>([]);
  const [bcaStatuses, setBcaStatuses] = useState<{ status: string; count: number }[]>([]);
  const [bcaStatusFilter, setBcaStatusFilter] = useState("all");
  const [bcaEventFilter, setBcaEventFilter] = useState("");

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("business_cards")
          .select("event_name, match_status");
        if (!data) return;
        // Events
        const evCounts: Record<string, number> = {};
        const stCounts: Record<string, number> = {};
        data.forEach((r: any) => {
          if (r.event_name) evCounts[r.event_name] = (evCounts[r.event_name] || 0) + 1;
          const st = r.match_status || "pending";
          stCounts[st] = (stCounts[st] || 0) + 1;
        });
        setBcaEvents(Object.entries(evCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
        setBcaStatuses(Object.entries(stCounts).map(([status, count]) => ({ status, count })));
      } catch { /* intentionally ignored: best-effort cleanup */ }
    };
    fetchMeta();
  }, []);

  const STATUS_LABELS: Record<string, string> = {
    matched: "Match", unmatched: "No match", pending: "Attesa",
  };

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca biglietto, azienda..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>

      <FilterSection icon={Filter} label="Stato match">
        <ChipGroup>
          <Chip active={bcaStatusFilter === "all"} onClick={() => setBcaStatusFilter("all")}>Tutti</Chip>
          {bcaStatuses.map(s => (
            <Chip key={s.status} active={bcaStatusFilter === s.status} onClick={() => setBcaStatusFilter(s.status)}>
              {STATUS_LABELS[s.status] || s.status} ({s.count})
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {bcaEvents.length > 0 && (
        <FilterSection icon={Users} label="Evento">
          <ChipGroup>
            <Chip active={bcaEventFilter === ""} onClick={() => setBcaEventFilter("")}>Tutti</Chip>
            {bcaEvents.map(e => (
              <Chip key={e.name} active={bcaEventFilter === e.name} onClick={() => setBcaEventFilter(e.name)}>
                {e.name} ({e.count})
              </Chip>
            ))}
          </ChipGroup>
        </FilterSection>
      )}
    </>
  );
}


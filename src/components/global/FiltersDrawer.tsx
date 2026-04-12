import { useState, useMemo, useEffect, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  SlidersHorizontal, Search, RotateCcw, Check, ArrowUpDown,
  Database, Filter, Layers, Users, Sparkles, Wifi,
  Plane, Mail, MessageCircle, Linkedin,
  ListTodo, Zap,
} from "lucide-react";
import { ROUTE_OUTREACH, ROUTE_NETWORK, ROUTE_CRM, ROUTE_AGENDA, ROUTE_EMAIL_COMPOSER } from "@/constants/routes";
import { useGlobalFilters, type CockpitChannelFilter, type CockpitQualityFilter, type WorkspaceFilterKey } from "@/contexts/GlobalFiltersContext";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { EmailComposerContactPicker } from "@/components/global/EmailComposerContactPicker";
import {
  COCKPIT_SORT, COCKPIT_ORIGIN, COCKPIT_CHANNEL, COCKPIT_QUALITY, COCKPIT_STATUS,
  FLAG, ATTIVITA_STATUS, ATTIVITA_PRIORITY,
  WS_CHIPS, EMAIL_GEN, SORTING_FILTERS,
} from "@/components/global/filters-drawer/constants";
import { FilterSection, ChipGroup, Chip } from "@/components/global/filters-drawer/shared";
import { CRMFiltersSection } from "@/components/global/filters-drawer/CRMFiltersSection";
import { NetworkFiltersSection } from "@/components/global/filters-drawer/NetworkFiltersSection";
import { InboxFiltersSection } from "@/components/global/filters-drawer/InboxFiltersSection";
import { BCAFiltersSection } from "@/components/global/filters-drawer/BCAFiltersSection";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";

interface FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  const seg = route.replace(/^\/v2/, "");
  const isOutreach = seg === "/outreach";
  const isNetwork = seg === "/network";
  const isCRM = seg === "/crm";
  const isAgenda = seg === "/agenda";
  const isEmailComposer = seg === "/email-composer";

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

  const sectionTitle = isCockpit ? "Cockpit" : isWorkspace ? "Workspace" : isInUscita ? "In Uscita" : isCircuito ? "Circuito" : isAttivita ? "Attività" : isEmail ? "Email" : isWhatsApp ? "WhatsApp" : isLinkedIn ? "LinkedIn" : isNetwork ? "Network" : isCRM ? (g.filters.crmActiveTab === "biglietti" ? "Biglietti da visita" : "CRM Contatti") : isAgenda ? "Agenda" : isEmailComposer ? "Email Composer" : "Globale";

  useEffect(() => {
    const handler = () => onOpenChange(false);
    window.addEventListener("filters-drawer-close", handler);
    return () => window.removeEventListener("filters-drawer-close", handler);
  }, [onOpenChange]);

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
      g.setCockpitCountries(new Set()); g.setCockpitChannels(new Set()); g.setCockpitQuality(new Set());
      g.setCockpitStatus("all"); g.setSortBy("name"); g.setOrigin(new Set(["wca", "import", "report_aziende", "bca"])); g.setSearch("");
    }
    if (isAttivita) { g.setAttivitaStatus("all"); g.setAttivitaPriority("all"); g.setSearch(""); }
    if (isEmail || isWhatsApp || isLinkedIn) { g.setSortingFilter("all"); g.setEmailCategory("all"); g.setEmailSort("date_desc"); g.setSortBy("date_desc"); g.setSortingSearch(""); }
    if (isWorkspace) { g.setWorkspaceFilters(new Set()); g.setEmailGenFilter("all"); g.setSearch(""); }
    if (isInUscita) { g.setSortingFilter("all"); g.setSortingSearch(""); }
    if (isNetwork) { g.setNetworkSearch(""); g.setNetworkQuality("all"); g.setNetworkSort("name"); g.setNetworkSelectedCountries(new Set()); g.setNetworkDirectoryOnly(false); }
    if (isCRM) { g.setSearch(""); g.setLeadStatus("all"); g.setHoldingPattern("out"); g.setCrmQuality("all"); g.setCrmChannel("all"); g.setGroupBy("country"); g.setSortBy("name"); }
  };

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

  const defaultWidthClass = isEmailComposer ? "w-[92vw] sm:w-[560px] sm:max-w-[620px]" : "w-[90vw] sm:w-[400px] sm:max-w-[420px]";

  return (
    <PageErrorBoundary>
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
          {/* Cockpit */}
          {isCockpit && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca contatto, azienda..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={ArrowUpDown} label="Ordina">
                <ChipGroup>{COCKPIT_SORT.map(o => <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>)}</ChipGroup>
              </FilterSection>
              <FilterSection icon={Database} label="Origine">
                <ChipGroup>{COCKPIT_ORIGIN.map(o => <Chip key={o.value} active={g.filters.origin.has(o.value)} onClick={() => toggleOrigin(o.value)}>{o.label}</Chip>)}</ChipGroup>
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
                <ChipGroup>{COCKPIT_CHANNEL.map(o => <Chip key={o.key} active={g.filters.cockpitChannels.has(o.key)} onClick={() => toggleCockpitChannel(o.key)}>{o.icon} {o.label}</Chip>)}</ChipGroup>
              </FilterSection>
              <FilterSection icon={Sparkles} label="Qualità">
                <ChipGroup>{COCKPIT_QUALITY.map(o => <Chip key={o.key} active={g.filters.cockpitQuality.has(o.key)} onClick={() => toggleCockpitQuality(o.key)}>{o.label}</Chip>)}</ChipGroup>
              </FilterSection>
              <FilterSection icon={Plane} label="Stato lead">
                <ChipGroup>{COCKPIT_STATUS.map(o => <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>{o.label}</Chip>)}</ChipGroup>
              </FilterSection>
            </>
          )}

          {/* Attività */}
          {isAttivita && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca attività..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={ListTodo} label="Stato">
                <ChipGroup>{ATTIVITA_STATUS.map(o => <Chip key={o.value} active={g.filters.attivitaStatus === o.value} onClick={() => g.setAttivitaStatus(o.value)}>{o.label}</Chip>)}</ChipGroup>
              </FilterSection>
              <FilterSection icon={Zap} label="Priorità">
                <ChipGroup>{ATTIVITA_PRIORITY.map(o => <Chip key={o.value} active={g.filters.attivitaPriority === o.value} onClick={() => g.setAttivitaPriority(o.value)}>{o.label}</Chip>)}</ChipGroup>
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

          {/* Workspace */}
          {isWorkspace && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={Mail} label="Stato email">
                <ChipGroup>{EMAIL_GEN.map(o => <Chip key={o.key} active={g.filters.emailGenFilter === o.key} onClick={() => g.setEmailGenFilter(o.key)}>{o.label}</Chip>)}</ChipGroup>
              </FilterSection>
              <FilterSection icon={Users} label="Contatti">
                <ChipGroup>{WS_CHIPS.map(o => <Chip key={o.key} active={g.filters.workspaceFilters.has(o.key)} onClick={() => toggleWs(o.key)}>{o.label}</Chip>)}</ChipGroup>
              </FilterSection>
            </>
          )}

          {/* In Uscita */}
          {isInUscita && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.sortingSearch} onChange={e => g.setSortingSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={Layers} label="Stato coda">
                <ChipGroup>{SORTING_FILTERS.map(o => <Chip key={o.key} active={g.filters.sortingFilter === o.key} onClick={() => g.setSortingFilter(o.key)}>{o.label}</Chip>)}</ChipGroup>
              </FilterSection>
            </>
          )}

          {/* Circuito */}
          {isCircuito && (
            <>
              <FilterSection icon={Search} label="Cerca">
                <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca..." className="h-8 text-xs bg-muted/30 border-border/40" />
              </FilterSection>
              <FilterSection icon={Plane} label="Fase">
                <ChipGroup>{COCKPIT_STATUS.map(o => <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>{o.label}</Chip>)}</ChipGroup>
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

          {/* Inbox */}
          {isInbox && (
            <InboxFiltersSection
              channel={isEmail ? "email" : isWhatsApp ? "whatsapp" : "linkedin"}
              channelIcon={isEmail ? Mail : isWhatsApp ? MessageCircle : Linkedin}
            />
          )}

          {isNetwork && <NetworkFiltersSection />}

          {isCRM && g.filters.crmActiveTab === "contatti" && <CRMFiltersSection />}
          {isCRM && g.filters.crmActiveTab === "biglietti" && <BCAFiltersSection />}

          {/* Agenda */}
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
                <ChipGroup>{ATTIVITA_PRIORITY.map(o => <Chip key={o.value} active={g.filters.attivitaPriority === o.value} onClick={() => g.setAttivitaPriority(o.value)}>{o.label}</Chip>)}</ChipGroup>
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

          {isEmailComposer && <EmailComposerContactPicker onConfirm={() => onOpenChange(false)} />}

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
    </PageErrorBoundary>
  );
}

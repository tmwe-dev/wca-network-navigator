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
import { useGlobalFilters, type WorkspaceFilterKey, type EmailGenFilter, type SortingFilterMode, type CockpitChannelFilter, type CockpitQualityFilter } from "@/contexts/GlobalFiltersContext";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useCountryStats } from "@/hooks/useCountryStats";
import { getCountryFlag, resolveCountryCode } from "@/lib/countries";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { EmailComposerContactPicker } from "@/components/global/EmailComposerContactPicker";

interface FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Constants ── */

const COCKPIT_SORT = [
  { value: "name", label: "Nome" },
  { value: "country", label: "Paese" },
  { value: "priority", label: "Priorità" },
  { value: "lastContact", label: "Ultimo" },
  { value: "company", label: "Azienda" },
];

const COCKPIT_ORIGIN = [
  { value: "wca", label: "WCA" },
  { value: "import", label: "Import" },
  { value: "report_aziende", label: "RA" },
  { value: "bca", label: "BCA" },
];

const COCKPIT_CHANNEL: { key: CockpitChannelFilter; label: string; icon: string }[] = [
  { key: "with_email", label: "Email", icon: "📧" },
  { key: "with_linkedin", label: "LinkedIn", icon: "🔗" },
  { key: "with_phone", label: "Telefono", icon: "📱" },
  { key: "with_whatsapp", label: "WhatsApp", icon: "💬" },
];

const COCKPIT_QUALITY: { key: CockpitQualityFilter; label: string }[] = [
  { key: "enriched", label: "Arricchiti" },
  { key: "not_enriched", label: "Non arricchiti" },
  { key: "with_alias", label: "Con alias" },
  { key: "no_alias", label: "Senza alias" },
];

const COCKPIT_STATUS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "in_progress", label: "In corso" },
  { value: "negotiation", label: "Trattativa" },
];

const FLAG: Record<string, string> = {
  IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", JP: "🇯🇵", RU: "🇷🇺", US: "🇺🇸",
  CN: "🇨🇳", BR: "🇧🇷", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹", PT: "🇵🇹", PL: "🇵🇱",
  TR: "🇹🇷", IN: "🇮🇳", AE: "🇦🇪", SA: "🇸🇦", KR: "🇰🇷", AU: "🇦🇺", CA: "🇨🇦", MX: "🇲🇽",
};

const ATTIVITA_STATUS = [
  { value: "all", label: "Tutte", icon: ListTodo },
  { value: "pending", label: "In attesa", icon: Clock },
  { value: "in_progress", label: "In corso", icon: AlertTriangle },
  { value: "completed", label: "Completate", icon: CheckCircle2 },
];

const ATTIVITA_PRIORITY = [
  { value: "all", label: "Tutte" },
  { value: "urgent", label: "🔴 Urgente" },
  { value: "high", label: "🟠 Alta" },
  { value: "medium", label: "🟡 Media" },
  { value: "low", label: "🟢 Bassa" },
];

const EMAIL_CATEGORIES = [
  { value: "all", label: "Tutte" },
  { value: "primary", label: "Principale" },
  { value: "notification", label: "Notifiche" },
  { value: "marketing", label: "Marketing" },
  { value: "spam", label: "Spam" },
];

const EMAIL_SORT = [
  { value: "date_desc", label: "Più recenti" },
  { value: "date_asc", label: "Più vecchi" },
];

const WS_CHIPS: { key: WorkspaceFilterKey; label: string }[] = [
  { key: "with_email", label: "Con email" },
  { key: "no_email", label: "No email" },
  { key: "with_contact", label: "Con contatto" },
  { key: "no_contact", label: "No contatto" },
  { key: "enriched", label: "Arricchito" },
  { key: "not_enriched", label: "Non arricchito" },
];

const EMAIL_GEN: { key: EmailGenFilter; label: string }[] = [
  { key: "all", label: "Tutte" },
  { key: "generated", label: "Generata" },
  { key: "to_generate", label: "Da generare" },
];

const SORTING_FILTERS: { key: SortingFilterMode; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "immediate", label: "⚡ Imm." },
  { key: "scheduled", label: "🕐 Prog." },
  { key: "unreviewed", label: "Da rivedere" },
  { key: "reviewed", label: "Rivisti" },
];

const NETWORK_SORT = [
  { value: "name", label: "Nome" },
  { value: "rating", label: "Rating" },
  { value: "contacts", label: "Contatti" },
];

const NETWORK_QUALITY = [
  { value: "all", label: "Tutti" },
  { value: "with_email", label: "📧 Con email" },
  { value: "with_phone", label: "📱 Con tel" },
  { value: "with_profile", label: "🔗 Con profilo" },
  { value: "no_email", label: "❌ Senza email" },
  { value: "no_contacts", label: "👤 Senza contatti" },
];

const CRM_GROUPBY = [
  { value: "country", label: "Paese" },
  { value: "origin", label: "Origine" },
  { value: "lead_status", label: "Stato" },
  { value: "import_group", label: "Gruppo" },
];

const CRM_SORT = [
  { value: "name", label: "Nome" },
  { value: "country", label: "Paese" },
  { value: "company", label: "Azienda" },
  { value: "date_desc", label: "Più recenti" },
  { value: "interaction", label: "Ultimo contatto" },
];

const CRM_ORIGIN = [
  { value: "wca", label: "WCA" },
  { value: "import", label: "Import" },
  { value: "report_aziende", label: "RA" },
  { value: "bca", label: "BCA" },
];

const CRM_LEAD_STATUS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "qualified", label: "Qualificato" },
  { value: "converted", label: "Convertito" },
];

const CRM_HOLDING = [
  { value: "out", label: "Fuori" },
  { value: "in", label: "In" },
  { value: "all", label: "Tutti" },
];

const CRM_QUALITY = [
  { value: "all", label: "Tutti" },
  { value: "enriched", label: "Arricchiti" },
  { value: "not_enriched", label: "Non arricchiti" },
  { value: "with_alias", label: "Con alias" },
  { value: "no_alias", label: "Senza alias" },
];

const CRM_CHANNEL = [
  { value: "all", label: "Tutti" },
  { value: "with_email", label: "📧 Email" },
  { value: "with_phone", label: "📱 Tel" },
  { value: "with_linkedin", label: "🔗 LI" },
  { value: "with_whatsapp", label: "💬 WA" },
];

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
  const [inlineSortOpen, setInlineSortOpen] = useState(false);

  const [crmCountries, setCrmCountries] = useState<{ value: string; name: string; flag: string; total: number }[]>([]);
  const [crmOrigins, setCrmOrigins] = useState<{ value: string; label: string; count: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const pageSize = 1000;

        const countryRows: any[] = [];
        let countryFrom = 0;
        while (true) {
          const { data: page, error } = await supabase
            .from("imported_contacts")
            .select("country")
            .range(countryFrom, countryFrom + pageSize - 1);
          if (error || !page || page.length === 0) break;
          countryRows.push(...page);
          if (page.length < pageSize) break;
          countryFrom += pageSize;
        }

        if (countryRows.length > 0) {
          const counts: Record<string, number> = {};
          countryRows.forEach((r: any) => {
            const raw = (r.country || "").trim();
            if (!raw) return;
            counts[raw] = (counts[raw] || 0) + 1;
          });

          const list = Object.entries(counts)
            .map(([value, total]) => {
              const resolved = resolveCountryCode(value);
              const wcaCountry = resolved ? WCA_COUNTRIES.find((c: any) => c.code === resolved) : null;
              return {
                value,
                name: wcaCountry?.name || value,
                flag: resolved ? getCountryFlag(resolved) : "",
                total,
              };
            })
            .sort((a, b) => b.total - a.total);
          setCrmCountries(list);
        }

        const originRows: any[] = [];
        let originFrom = 0;
        while (true) {
          const { data: page, error } = await supabase
            .from("imported_contacts")
            .select("origin")
            .range(originFrom, originFrom + pageSize - 1);
          if (error || !page || page.length === 0) break;
          originRows.push(...page);
          if (page.length < pageSize) break;
          originFrom += pageSize;
        }

        if (originRows.length > 0) {
          const oCounts: Record<string, number> = {};
          originRows.forEach((r: any) => {
            const o = (r.origin || "").trim();
            if (o) oCounts[o] = (oCounts[o] || 0) + 1;
          });
          const oList = Object.entries(oCounts)
            .map(([value, count]) => ({ value, label: value, count }))
            .sort((a, b) => b.count - a.count);
          setCrmOrigins(oList);
        }
      } catch {}
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

  const searchValue = g.filters.search;
  useEffect(() => {
    if (searchValue.trim().length < 2) {
      setSearchResults([]);
      return;
    }

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
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  return (
    <>
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

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <FilterSection icon={Layers} label="Raggruppa per">
              <ChipGroup>
                {CRM_GROUPBY.map(o => (
                  <Chip key={o.value} active={g.filters.groupBy === o.value} onClick={() => g.setGroupBy(o.value)}>{o.label}</Chip>
                ))}
              </ChipGroup>
            </FilterSection>
          </div>
          <div className="shrink-0 pt-7">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setInlineSortOpen(v => !v)}>
              <ArrowUpDown className="w-3.5 h-3.5" /> Ordina
            </Button>
          </div>
        </div>

        {inlineSortOpen && (
          <div className="rounded-lg border border-border/40 bg-muted/10 p-2">
            <ChipGroup>
              {CRM_SORT.map(o => <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>)}
            </ChipGroup>
          </div>
        )}
      </div>

      <CRMContactNavigator groupBy={g.filters.groupBy} />

      <div className="rounded-lg border border-border/40 bg-muted/10 p-2 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="w-3.5 h-3.5" /> Filtri contesto
        </div>

        <FilterSection icon={Database} label="Origine">
          <ChipGroup>
            {crmOrigins.map(o => (
              <Chip key={o.value} active={g.filters.crmOrigin.has(o.value)} onClick={() => toggleCrmOrigin(o.value)}>
                {o.label} <span className="ml-0.5 text-[8px] opacity-60">({o.count})</span>
              </Chip>
            ))}
          </ChipGroup>
        </FilterSection>

        <div className="grid grid-cols-2 gap-2">
          <FilterSection icon={Users} label="Stato">
            <ChipGroup>
              {CRM_LEAD_STATUS.map(o => <Chip key={o.value} active={g.filters.leadStatus === o.value} onClick={() => g.setLeadStatus(o.value)}>{o.label}</Chip>)}
            </ChipGroup>
          </FilterSection>
          <FilterSection icon={Plane} label="Circuito">
            <ChipGroup>
              {CRM_HOLDING.map(o => <Chip key={o.value} active={g.filters.holdingPattern === o.value} onClick={() => g.setHoldingPattern(o.value)}>{o.label}</Chip>)}
            </ChipGroup>
          </FilterSection>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FilterSection icon={Wifi} label="Canale">
            <ChipGroup>
              {CRM_CHANNEL.map(o => <Chip key={o.value} active={g.filters.crmChannel === o.value} onClick={() => g.setCrmChannel(o.value)}>{o.label}</Chip>)}
            </ChipGroup>
          </FilterSection>
          <FilterSection icon={Sparkles} label="Qualità">
            <ChipGroup>
              {CRM_QUALITY.map(o => <Chip key={o.value} active={g.filters.crmQuality === o.value} onClick={() => g.setCrmQuality(o.value)}>{o.label}</Chip>)}
            </ChipGroup>
          </FilterSection>
        </div>

        <FilterSection icon={Globe} label={`Paesi (${g.filters.crmSelectedCountries.size > 0 ? g.filters.crmSelectedCountries.size + ' sel.' : 'tutti'})`}>
          {selectedCountries.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {selectedCountries.map((country) => (
                <button
                  key={country.value}
                  onClick={() => toggleCountry(country.value)}
                  className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                >
                  <span>{country.flag}</span>
                  <span className="max-w-[90px] truncate">{country.name}</span>
                  ×
                </button>
              ))}
              <button onClick={() => g.setCrmSelectedCountries(new Set())} className="text-[9px] text-destructive hover:underline ml-1">Reset</button>
            </div>
          )}
          <Input value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Cerca paese..." className="h-6 text-[10px] bg-muted/30 border-border/40 mb-1" />
          <div className="max-h-[140px] overflow-y-auto rounded border border-border/40 bg-muted/10 p-0.5">
            {filteredCountries.map(c => (
              <button
                key={c.value}
                onClick={() => toggleCountry(c.value)}
                className={cn(
                  "w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] transition-all",
                  g.filters.crmSelectedCountries.has(c.value) ? "bg-primary/15 text-primary" : "hover:bg-muted/40"
                )}
              >
                <span className="text-sm w-4 text-center">{c.flag}</span>
                <span className="flex-1 text-left truncate">{c.name}</span>
                {g.filters.crmSelectedCountries.has(c.value) && <Check className="w-2.5 h-2.5 text-primary" />}
                <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{c.total}</Badge>
              </button>
            ))}
          </div>
        </FilterSection>
      </div>
    </>
  );
}

/* ── CRM Contact Quick Actions (⋮ menu) ── */
function CRMContactQuickActions({ contact }: { contact: any }) {
  const navigate = useNavigate();
  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contact.email) return;
    navigate("/email-composer", {
      state: {
        prefilledRecipient: {
          email: contact.email,
          name: contact.name || undefined,
          company: contact.company_name || undefined,
          contactId: contact.id,
        },
      },
    });
  };
  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = (contact.phone || contact.mobile || "").replace(/[^0-9+]/g, "");
    if (phone) window.open(`https://wa.me/${phone.replace("+", "")}`, "_blank");
  };
  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
      {contact.email && (
        <button onClick={handleEmail} className="p-0.5 rounded hover:bg-primary/10" title="Email">
          <Mail className="w-3 h-3 text-primary" />
        </button>
      )}
      {(contact.phone || contact.mobile) && (
        <button onClick={handleWhatsApp} className="p-0.5 rounded hover:bg-emerald-500/10" title="WhatsApp">
          <MessageCircle className="w-3 h-3 text-emerald-500" />
        </button>
      )}
    </div>
  );
}

/* ── CRM Contact Group Navigator ── */

function CRMContactNavigator({ groupBy }: { groupBy: string }) {
  const g = useGlobalFilters();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [groupContacts, setGroupContacts] = useState<Record<string, any[]>>({});
  const [groups, setGroups] = useState<{ key: string; label: string; count: number }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [cityFilter, setCityFilter] = useState<Record<string, string>>({});
  const [contactSort, setContactSort] = useState<{ field: string; asc: boolean }>({ field: "name", asc: true });
  useEffect(() => {
    const fetchGroups = async () => {
      setGroupsLoading(true);
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const colMap: Record<string, string> = {
          country: "country",
          origin: "origin",
          lead_status: "lead_status",
          import_group: "import_log_id",
        };
        const col = colMap[groupBy] || "country";

        const allRows: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data: page, error: pageError } = await supabase
            .from("imported_contacts")
            .select(col)
            .or("company_name.not.is.null,name.not.is.null,email.not.is.null")
            .range(from, from + pageSize - 1);
          if (pageError || !page || page.length === 0) break;
          allRows.push(...page);
          if (page.length < pageSize) break;
          from += pageSize;
        }

        if (allRows.length === 0) {
          setGroups([]);
          return;
        }

        const counts = new Map<string, number>();
        for (const row of allRows as any[]) {
          const val = row[col] || (groupBy === "country" ? "Sconosciuto" : groupBy === "origin" ? "Sconosciuta" : "—");
          counts.set(val, (counts.get(val) || 0) + 1);
        }

        const STATUS_LABELS: Record<string, string> = {
          new: "Nuovo",
          contacted: "Contattato",
          in_progress: "In corso",
          negotiation: "Trattativa",
          converted: "Cliente",
          lost: "Perso",
        };

        const grouped = Array.from(counts.entries())
          .map(([key, count]) => ({
            key,
            label: groupBy === "lead_status" ? (STATUS_LABELS[key] || key) : key,
            count,
          }))
          .sort((a, b) => b.count - a.count);

        setGroups(grouped);
      } catch {
        setGroups([]);
      } finally {
        setGroupsLoading(false);
      }
    };

    fetchGroups();
  }, [groupBy]);

  const toggleGroup = async (key: string) => {
    const next = new Set(openGroups);
    if (next.has(key)) {
      next.delete(key);
      setOpenGroups(next);
      return;
    }
    next.add(key);
    setOpenGroups(next);

    if (!groupContacts[key]) {
      setLoadingGroup(key);
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const allContacts: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          let q = supabase
            .from("imported_contacts")
            .select("id, name, company_name, company_alias, country, email, position, origin, phone, mobile, city, lead_status")
            .or("company_name.not.is.null,name.not.is.null,email.not.is.null")
            .order("company_name", { ascending: true })
            .range(from, from + pageSize - 1);

          switch (groupBy) {
            case "country":
              if (key === "Sconosciuto") q = q.is("country", null);
              else q = q.eq("country", key);
              break;
            case "origin":
              if (key === "Sconosciuta") q = q.is("origin", null);
              else q = q.eq("origin", key);
              break;
            case "lead_status":
              q = q.eq("lead_status", key);
              break;
            case "import_group":
              q = q.eq("import_log_id", key);
              break;
          }

          const { data: page } = await q;
          if (!page || page.length === 0) break;
          allContacts.push(...page);
          if (page.length < pageSize) break;
          from += pageSize;
        }

        setGroupContacts(prev => ({ ...prev, [key]: allContacts }));
      } catch {
      } finally {
        setLoadingGroup(null);
      }
    }
  };

  const selectContact = (contactId: string) => {
    window.dispatchEvent(new CustomEvent("crm-select-contact", { detail: { contactId } }));
    window.dispatchEvent(new CustomEvent("filters-drawer-close"));
  };

  const applySearchFilter = (value?: string) => {
    if (!value) return;
    g.setSearch(value);
  };

  const addCountryFilter = (country?: string) => {
    if (!country) return;
    const next = new Set(g.filters.crmSelectedCountries);
    next.add(country);
    g.setCrmSelectedCountries(next);
  };

  const addOriginFilter = (origin?: string) => {
    if (!origin) return;
    const next = new Set(g.filters.crmOrigin);
    next.add(origin);
    g.setCrmOrigin(next);
  };

  if (groupsLoading) {
    return <div className="text-center py-4 text-[11px] text-muted-foreground">Caricamento gruppi…</div>;
  }

  if (groups.length === 0) {
    return <div className="text-center py-4 text-[11px] text-muted-foreground">Nessun gruppo trovato</div>;
  }

  const SORT_OPTIONS = [
    { field: "name", label: "Nome" },
    { field: "company", label: "Azienda" },
    { field: "city", label: "Città" },
    { field: "country", label: "Paese" },
  ];

  const sortContacts = (list: any[]) => {
    if (!list) return list;
    return [...list].sort((a, b) => {
      const fa = contactSort.field;
      const va = (fa === "company" ? (a.company_alias || a.company_name) : a[fa]) || "";
      const vb = (fa === "company" ? (b.company_alias || b.company_name) : b[fa]) || "";
      const cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
      return contactSort.asc ? cmp : -cmp;
    });
  };

  const toggleSort = (field: string) => {
    setContactSort(prev => prev.field === field ? { field, asc: !prev.asc } : { field, asc: true });
  };

  return (
    <div className="flex-1 min-h-0">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
        <Users className="w-3 h-3" /> Contatti per {groupBy === "country" ? "paese" : groupBy === "origin" ? "origine" : groupBy === "lead_status" ? "stato" : "gruppo"}
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto">{groups.reduce((s, g) => s + g.count, 0)}</Badge>
      </label>
      <div className="flex flex-wrap gap-0.5 mb-1.5">
        {SORT_OPTIONS.map(o => (
          <button
            key={o.field}
            onClick={() => toggleSort(o.field)}
            className={cn(
              "px-2 py-0.5 rounded text-[9px] font-medium border transition-all",
              contactSort.field === o.field
                ? "bg-primary/15 border-primary/30 text-primary"
                : "border-border/30 text-muted-foreground hover:bg-muted/40"
            )}
          >
            {o.label} {contactSort.field === o.field ? (contactSort.asc ? "↑" : "↓") : ""}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border/40 bg-muted/10 max-h-[calc(100vh-380px)] overflow-y-auto">
        {groups.map(group => {
          const isOpen = openGroups.has(group.key);
          const contacts = groupContacts[group.key];
          const cf = cityFilter[group.key]?.toLowerCase() || "";
          const filteredContacts = contacts && cf
            ? contacts.filter((c: any) =>
                (c.city || "").toLowerCase().includes(cf) ||
                (c.name || "").toLowerCase().includes(cf) ||
                (c.company_name || "").toLowerCase().includes(cf)
              )
            : contacts;
          const groupCountryCode = groupBy === "country" ? resolveCountryCode(group.key) : null;

          return (
            <div key={group.key} className="border-b border-border/20 last:border-b-0">
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/40 transition-colors",
                  isOpen && "bg-primary/5"
                )}
              >
                <span className="text-[10px] text-muted-foreground">{isOpen ? "▾" : "▸"}</span>
                {groupBy === "country" && <span className="text-sm w-4 text-center">{groupCountryCode ? getCountryFlag(groupCountryCode) : ""}</span>}
                <span className="text-xs font-medium truncate flex-1">{group.label}</span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{group.count}</Badge>
              </button>
              {isOpen && (
                <div className="bg-background/50">
                  {loadingGroup === group.key ? (
                    <div className="px-3 py-2 text-[10px] text-muted-foreground">Caricamento…</div>
                  ) : filteredContacts && filteredContacts.length > 0 ? (
                    <>
                      {contacts && contacts.length > 10 && (
                        <div className="px-2 py-1 border-b border-border/10">
                          <Input
                            value={cityFilter[group.key] || ""}
                            onChange={e => setCityFilter(prev => ({ ...prev, [group.key]: e.target.value }))}
                            placeholder="Filtra per città/nome…"
                            className="h-6 text-[10px] bg-muted/20 border-border/30"
                          />
                        </div>
                      )}
                      {filteredContacts.map((c: any) => {
                        const resolvedCountry = resolveCountryCode(c.country || "");
                        return (
                          <div
                            key={c.id}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-primary/10 transition-colors border-t border-border/10 group/card"
                          >
                            <div className="flex items-start gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addCountryFilter(c.country);
                                }}
                                className="text-xs shrink-0 mt-0.5 w-4 text-center"
                              >
                                {resolvedCountry ? getCountryFlag(resolvedCountry) : ""}
                              </button>

                              <div onClick={() => selectContact(c.id)} className="flex-1 min-w-0 text-left cursor-pointer">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    applySearchFilter(c.company_alias || c.company_name || c.name);
                                  }}
                                  className="text-[11px] font-medium truncate leading-tight w-full text-left hover:text-primary"
                                >
                                  {c.company_alias || c.company_name || c.name || "—"}
                                </button>

                                <div className="flex items-center text-[9px] text-muted-foreground leading-tight mt-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applySearchFilter(c.name || c.position);
                                    }}
                                    className="truncate min-w-0 flex-1 text-left hover:text-primary"
                                  >
                                    {c.name || "—"}{c.position ? ` · ${c.position}` : ""}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applySearchFilter(c.city);
                                    }}
                                    className="shrink-0 w-[70px] text-right truncate text-muted-foreground/70 hover:text-primary"
                                  >
                                    {c.city || ""}
                                  </button>
                                </div>

                                <div className="flex items-center text-[8px] text-muted-foreground leading-tight mt-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applySearchFilter(c.email);
                                    }}
                                    className="truncate min-w-0 flex-1 flex items-center gap-0.5 text-left hover:text-primary"
                                  >
                                    {c.email ? <><Mail className="w-2.5 h-2.5 shrink-0" />{c.email}</> : "—"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applySearchFilter(c.phone || c.mobile);
                                    }}
                                    className="shrink-0 w-[80px] text-right truncate flex items-center justify-end gap-0.5 hover:text-primary"
                                  >
                                    {(c.phone || c.mobile) ? <><Phone className="w-2.5 h-2.5 shrink-0" />{c.phone || c.mobile}</> : ""}
                                  </button>
                                  {c.origin && groupBy !== "origin" && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addOriginFilter(c.origin);
                                      }}
                                      className="shrink-0 ml-1"
                                    >
                                      <Badge variant="outline" className="text-[7px] h-3 px-1">{c.origin}</Badge>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <CRMContactQuickActions contact={c} />
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : contacts && contacts.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-muted-foreground">Nessun contatto</div>
                  ) : filteredContacts && filteredContacts.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-muted-foreground">Nessun risultato per il filtro</div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
      } catch {}
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

function FilterSection({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );
}

function ChipGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border flex items-center gap-1",
        active
          ? "bg-primary/15 border-primary/30 text-primary shadow-sm shadow-primary/5"
          : "border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

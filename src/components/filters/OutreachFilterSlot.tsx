import { useMemo } from "react";
import { useGlobalFilters, type WorkspaceFilterKey, type EmailGenFilter, type SortingFilterMode, type CockpitChannelFilter, type CockpitQualityFilter } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { Search, Mail, Users, Database, ArrowUpDown, Layers, Wifi, Sparkles, Filter, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";

const SORT_OPTIONS = [
  { value: "name", label: "Nome" },
  { value: "country", label: "Paese" },
  { value: "priority", label: "Priorità" },
  { value: "lastContact", label: "Ultimo" },
  { value: "company", label: "Azienda" },
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

const HOLDING_FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "in", label: "In circuito" },
  { value: "out", label: "Fuori" },
];

const FLAG: Record<string, string> = {
  IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", JP: "🇯🇵", RU: "🇷🇺", US: "🇺🇸",
  CN: "🇨🇳", BR: "🇧🇷", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹", PT: "🇵🇹", PL: "🇵🇱",
  TR: "🇹🇷", IN: "🇮🇳", AE: "🇦🇪", SA: "🇸🇦", KR: "🇰🇷", AU: "🇦🇺", CA: "🇨🇦", MX: "🇲🇽",
};

interface Props {
  tab: string;
}

export function OutreachFilterSlot({ tab }: Props) {
  const g = useGlobalFilters();
  const { contacts } = useCockpitContacts();

  const isCockpit = tab === "cockpit";
  const isWorkspace = tab === "workspace";
  const isInUscita = tab === "inuscita";
  const isCircuito = tab === "circuito";
  const isInbox = ["email", "whatsapp", "linkedin"].includes(tab);

  // Compute country stats from cockpit contacts
  const countryStats = useMemo(() => {
    if (!isCockpit || !contacts.length) return [];
    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      const cc = c.country?.toUpperCase() || "??";
      counts[cc] = (counts[cc] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count, flag: FLAG[code] || "🌍" }));
  }, [contacts, isCockpit]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (g.filters.cockpitCountries.size) n++;
    if (g.filters.cockpitChannels.size) n++;
    if (g.filters.cockpitQuality.size) n++;
    if (g.filters.cockpitStatus !== "all") n++;
    return n;
  }, [g.filters]);

  const toggleWs = (key: WorkspaceFilterKey) => {
    const next = new Set(g.filters.workspaceFilters);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setWorkspaceFilters(next);
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

  return (
    <div className="space-y-3">
      {/* Search — always */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <Search className="w-3 h-3" /> Cerca
        </label>
        <Input
          value={isInUscita ? g.filters.sortingSearch : g.filters.search}
          onChange={e => isInUscita ? g.setSortingSearch(e.target.value) : g.setSearch(e.target.value)}
          placeholder={isInbox ? "Cerca messaggio..." : "Cerca..."}
          className="h-7 text-xs bg-muted/30 border-border/40"
        />
      </div>

      {/* Cockpit: full filter suite */}
      {isCockpit && (
        <>
          {/* Active filter count */}
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-primary font-medium">{activeFilterCount} filtri attivi</span>
              <button onClick={() => {
                g.setCockpitCountries(new Set());
                g.setCockpitChannels(new Set());
                g.setCockpitQuality(new Set());
                g.setCockpitStatus("all");
              }} className="text-[9px] text-muted-foreground hover:text-destructive">Reset</button>
            </div>
          )}

          {/* Sort */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <ArrowUpDown className="w-3 h-3" /> Ordina
            </label>
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.map(o => (
                <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
              ))}
            </div>
          </div>

          {/* Origin */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Database className="w-3 h-3" /> Origine
            </label>
            <div className="flex flex-wrap gap-1">
              {["wca", "import", "report_aziende", "bca"].map(o => (
                <Chip key={o} active={g.filters.origin.has(o)} onClick={() => {
                  const next = new Set(g.filters.origin);
                  if (next.has(o)) { if (next.size > 1) next.delete(o); } else next.add(o);
                  g.setOrigin(next);
                }}>{o === "report_aziende" ? "RA" : o.toUpperCase()}</Chip>
              ))}
            </div>
          </div>

          {/* Country */}
          {countryStats.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                <Filter className="w-3 h-3" /> Paese
              </label>
              <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
                {countryStats.slice(0, 20).map(({ code, count, flag }) => (
                  <Chip key={code} active={g.filters.cockpitCountries.has(code)} onClick={() => toggleCockpitCountry(code)}>
                    {flag} {code} <Badge variant="secondary" className="text-[8px] h-3 px-1 ml-0.5">{count}</Badge>
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Channel */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Wifi className="w-3 h-3" /> Canale
            </label>
            <div className="flex flex-wrap gap-1">
              {COCKPIT_CHANNEL.map(o => (
                <Chip key={o.key} active={g.filters.cockpitChannels.has(o.key)} onClick={() => toggleCockpitChannel(o.key)}>
                  {o.icon} {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Sparkles className="w-3 h-3" /> Qualità
            </label>
            <div className="flex flex-wrap gap-1">
              {COCKPIT_QUALITY.map(o => (
                <Chip key={o.key} active={g.filters.cockpitQuality.has(o.key)} onClick={() => toggleCockpitQuality(o.key)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Plane className="w-3 h-3" /> Stato
            </label>
            <div className="flex flex-wrap gap-1">
              {COCKPIT_STATUS.map(o => (
                <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Workspace filters */}
      {isWorkspace && (
        <>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Mail className="w-3 h-3" /> Stato email
            </label>
            <div className="flex flex-wrap gap-1">
              {EMAIL_GEN.map(o => (
                <Chip key={o.key} active={g.filters.emailGenFilter === o.key} onClick={() => g.setEmailGenFilter(o.key)}>{o.label}</Chip>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Users className="w-3 h-3" /> Contatti
            </label>
            <div className="flex flex-wrap gap-1">
              {WS_CHIPS.map(o => (
                <Chip key={o.key} active={g.filters.workspaceFilters.has(o.key)} onClick={() => toggleWs(o.key)}>{o.label}</Chip>
              ))}
            </div>
          </div>
        </>
      )}

      {/* In Uscita: sorting filters */}
      {isInUscita && (
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
            <Layers className="w-3 h-3" /> Stato coda
          </label>
          <div className="flex flex-wrap gap-1">
            {SORTING_FILTERS.map(o => (
              <Chip key={o.key} active={g.filters.sortingFilter === o.key} onClick={() => g.setSortingFilter(o.key)}>{o.label}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* Circuito */}
      {isCircuito && (
        <>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Plane className="w-3 h-3" /> Fase
            </label>
            <div className="flex flex-wrap gap-1">
              {COCKPIT_STATUS.map(o => (
                <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <ArrowUpDown className="w-3 h-3" /> Ordina
            </label>
            <div className="flex flex-wrap gap-1">
              {[{ value: "name", label: "Nome" }, { value: "lastContact", label: "Ultimo contatto" }, { value: "company", label: "Azienda" }].map(o => (
                <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Inbox: search + read/unread */}
      {isInbox && (
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
            <Mail className="w-3 h-3" /> Stato
          </label>
          <div className="flex flex-wrap gap-1">
            <Chip active={g.filters.sortingFilter === "all"} onClick={() => g.setSortingFilter("all")}>Tutti</Chip>
            <Chip active={g.filters.sortingFilter === "unreviewed"} onClick={() => g.setSortingFilter("unreviewed")}>Non letti</Chip>
            <Chip active={g.filters.sortingFilter === "reviewed"} onClick={() => g.setSortingFilter("reviewed")}>Letti</Chip>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded-md text-[10px] font-medium transition-all border flex items-center gap-0.5",
        active
          ? "bg-primary/15 border-primary/30 text-primary"
          : "border-border/40 text-muted-foreground hover:bg-muted/40"
      )}
    >
      {children}
    </button>
  );
}

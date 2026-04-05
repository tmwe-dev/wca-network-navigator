import { useMemo } from "react";
import { useGlobalFilters, type WorkspaceFilterKey, type EmailGenFilter, type SortingFilterMode, type CockpitChannelFilter, type CockpitQualityFilter } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { Search, Mail, Users, Database, ArrowUpDown, Layers, Wifi, Sparkles, Filter, Plane, ListTodo, Clock, CheckCircle2, AlertTriangle, Zap, MessageCircle, Linkedin, Tag } from "lucide-react";
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
  const isAttivita = tab === "attivita";
  const isEmail = tab === "email";
  const isWhatsApp = tab === "whatsapp";
  const isLinkedIn = tab === "linkedin";
  const isInbox = isEmail || isWhatsApp || isLinkedIn;

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
    if (isCockpit) {
      if (g.filters.cockpitCountries.size) n++;
      if (g.filters.cockpitChannels.size) n++;
      if (g.filters.cockpitQuality.size) n++;
      if (g.filters.cockpitStatus !== "all") n++;
    }
    if (isAttivita) {
      if (g.filters.attivitaStatus !== "all") n++;
      if (g.filters.attivitaPriority !== "all") n++;
    }
    if (isEmail) {
      if (g.filters.emailCategory !== "all") n++;
      if (g.filters.sortingFilter !== "all") n++;
    }
    return n;
  }, [g.filters, isCockpit, isAttivita, isEmail]);

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
          placeholder={isInbox ? "Cerca messaggio..." : isAttivita ? "Cerca attività..." : "Cerca..."}
          className="h-7 text-xs bg-muted/30 border-border/40"
        />
      </div>

      {/* Active filter count */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-primary font-medium">{activeFilterCount} filtri attivi</span>
          <button onClick={() => {
            if (isCockpit) {
              g.setCockpitCountries(new Set());
              g.setCockpitChannels(new Set());
              g.setCockpitQuality(new Set());
              g.setCockpitStatus("all");
            }
            if (isAttivita) {
              g.setAttivitaStatus("all");
              g.setAttivitaPriority("all");
            }
            if (isEmail) {
              g.setEmailCategory("all");
              g.setSortingFilter("all");
            }
          }} className="text-[9px] text-muted-foreground hover:text-destructive">Reset</button>
        </div>
      )}

      {/* ═══ COCKPIT ═══ */}
      {isCockpit && (
        <>
          <FilterSection icon={ArrowUpDown} label="Ordina">
            <ChipGroup>
              {SORT_OPTIONS.map(o => (
                <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Database} label="Origine">
            <ChipGroup>
              {["wca", "import", "report_aziende", "bca"].map(o => (
                <Chip key={o} active={g.filters.origin.has(o)} onClick={() => {
                  const next = new Set(g.filters.origin);
                  if (next.has(o)) { if (next.size > 1) next.delete(o); } else next.add(o);
                  g.setOrigin(next);
                }}>{o === "report_aziende" ? "RA" : o.toUpperCase()}</Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          {countryStats.length > 0 && (
            <FilterSection icon={Filter} label="Paese">
              <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
                {countryStats.slice(0, 20).map(({ code, count, flag }) => (
                  <Chip key={code} active={g.filters.cockpitCountries.has(code)} onClick={() => toggleCockpitCountry(code)}>
                    {flag} {code} <Badge variant="secondary" className="text-[8px] h-3 px-1 ml-0.5">{count}</Badge>
                  </Chip>
                ))}
              </div>
            </FilterSection>
          )}

          <FilterSection icon={Wifi} label="Canale">
            <ChipGroup>
              {COCKPIT_CHANNEL.map(o => (
                <Chip key={o.key} active={g.filters.cockpitChannels.has(o.key)} onClick={() => toggleCockpitChannel(o.key)}>
                  {o.icon} {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Sparkles} label="Qualità">
            <ChipGroup>
              {COCKPIT_QUALITY.map(o => (
                <Chip key={o.key} active={g.filters.cockpitQuality.has(o.key)} onClick={() => toggleCockpitQuality(o.key)}>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Plane} label="Stato">
            <ChipGroup>
              {COCKPIT_STATUS.map(o => (
                <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>
        </>
      )}

      {/* ═══ ATTIVITÀ ═══ */}
      {isAttivita && (
        <>
          <FilterSection icon={ListTodo} label="Stato">
            <ChipGroup>
              {ATTIVITA_STATUS.map(o => (
                <Chip key={o.value} active={g.filters.attivitaStatus === o.value} onClick={() => g.setAttivitaStatus(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Zap} label="Priorità">
            <ChipGroup>
              {ATTIVITA_PRIORITY.map(o => (
                <Chip key={o.value} active={g.filters.attivitaPriority === o.value} onClick={() => g.setAttivitaPriority(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={ArrowUpDown} label="Ordina">
            <ChipGroup>
              {[
                { value: "date_desc", label: "Più recenti" },
                { value: "date_asc", label: "Più vecchi" },
                { value: "priority", label: "Priorità" },
              ].map(o => (
                <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>
        </>
      )}

      {/* ═══ WORKSPACE ═══ */}
      {isWorkspace && (
        <>
          <FilterSection icon={Mail} label="Stato email">
            <ChipGroup>
              {EMAIL_GEN.map(o => (
                <Chip key={o.key} active={g.filters.emailGenFilter === o.key} onClick={() => g.setEmailGenFilter(o.key)}>{o.label}</Chip>
              ))}
            </ChipGroup>
          </FilterSection>
          <FilterSection icon={Users} label="Contatti">
            <ChipGroup>
              {WS_CHIPS.map(o => (
                <Chip key={o.key} active={g.filters.workspaceFilters.has(o.key)} onClick={() => toggleWs(o.key)}>{o.label}</Chip>
              ))}
            </ChipGroup>
          </FilterSection>
        </>
      )}

      {/* ═══ IN USCITA ═══ */}
      {isInUscita && (
        <FilterSection icon={Layers} label="Stato coda">
          <ChipGroup>
            {SORTING_FILTERS.map(o => (
              <Chip key={o.key} active={g.filters.sortingFilter === o.key} onClick={() => g.setSortingFilter(o.key)}>{o.label}</Chip>
            ))}
          </ChipGroup>
        </FilterSection>
      )}

      {/* ═══ CIRCUITO ═══ */}
      {isCircuito && (
        <>
          <FilterSection icon={Plane} label="Fase">
            <ChipGroup>
              {COCKPIT_STATUS.map(o => (
                <Chip key={o.value} active={g.filters.cockpitStatus === o.value} onClick={() => g.setCockpitStatus(o.value)}>
                  {o.label}
                </Chip>
              ))}
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

      {/* ═══ EMAIL INBOX ═══ */}
      {isEmail && (
        <>
          <FilterSection icon={Mail} label="Stato">
            <ChipGroup>
              <Chip active={g.filters.sortingFilter === "all"} onClick={() => g.setSortingFilter("all")}>Tutti</Chip>
              <Chip active={g.filters.sortingFilter === "unreviewed"} onClick={() => g.setSortingFilter("unreviewed")}>Non letti</Chip>
              <Chip active={g.filters.sortingFilter === "reviewed"} onClick={() => g.setSortingFilter("reviewed")}>Letti</Chip>
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Tag} label="Categoria">
            <ChipGroup>
              {EMAIL_CATEGORIES.map(o => (
                <Chip key={o.value} active={g.filters.emailCategory === o.value} onClick={() => g.setEmailCategory(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={ArrowUpDown} label="Ordina">
            <ChipGroup>
              {EMAIL_SORT.map(o => (
                <Chip key={o.value} active={g.filters.emailSort === o.value} onClick={() => g.setEmailSort(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>
        </>
      )}

      {/* ═══ WHATSAPP INBOX ═══ */}
      {isWhatsApp && (
        <>
          <FilterSection icon={MessageCircle} label="Stato">
            <ChipGroup>
              <Chip active={g.filters.sortingFilter === "all"} onClick={() => g.setSortingFilter("all")}>Tutti</Chip>
              <Chip active={g.filters.sortingFilter === "unreviewed"} onClick={() => g.setSortingFilter("unreviewed")}>Non letti</Chip>
              <Chip active={g.filters.sortingFilter === "reviewed"} onClick={() => g.setSortingFilter("reviewed")}>Letti</Chip>
            </ChipGroup>
          </FilterSection>
          <FilterSection icon={ArrowUpDown} label="Ordina">
            <ChipGroup>
              <Chip active={g.filters.sortBy === "date_desc"} onClick={() => g.setSortBy("date_desc")}>Più recenti</Chip>
              <Chip active={g.filters.sortBy === "date_asc"} onClick={() => g.setSortBy("date_asc")}>Più vecchi</Chip>
              <Chip active={g.filters.sortBy === "unread"} onClick={() => g.setSortBy("unread")}>Non letti prima</Chip>
            </ChipGroup>
          </FilterSection>
        </>
      )}

      {/* ═══ LINKEDIN INBOX ═══ */}
      {isLinkedIn && (
        <>
          <FilterSection icon={Linkedin} label="Stato">
            <ChipGroup>
              <Chip active={g.filters.sortingFilter === "all"} onClick={() => g.setSortingFilter("all")}>Tutti</Chip>
              <Chip active={g.filters.sortingFilter === "unreviewed"} onClick={() => g.setSortingFilter("unreviewed")}>Non letti</Chip>
              <Chip active={g.filters.sortingFilter === "reviewed"} onClick={() => g.setSortingFilter("reviewed")}>Letti</Chip>
            </ChipGroup>
          </FilterSection>
          <FilterSection icon={ArrowUpDown} label="Ordina">
            <ChipGroup>
              <Chip active={g.filters.sortBy === "date_desc"} onClick={() => g.setSortBy("date_desc")}>Più recenti</Chip>
              <Chip active={g.filters.sortBy === "date_asc"} onClick={() => g.setSortBy("date_asc")}>Più vecchi</Chip>
              <Chip active={g.filters.sortBy === "unread"} onClick={() => g.setSortBy("unread")}>Non letti prima</Chip>
            </ChipGroup>
          </FilterSection>
        </>
      )}
    </div>
  );
}

/* ── Shared sub-components ── */

function FilterSection({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
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

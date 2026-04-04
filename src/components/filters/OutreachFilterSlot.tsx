import { useGlobalFilters, type WorkspaceFilterKey, type EmailGenFilter, type SortingFilterMode } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { Search, Mail, Users, Database, ArrowUpDown, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";

const SORT_OPTIONS = [
  { value: "name", label: "Nome" },
  { value: "country", label: "Paese" },
  { value: "priority", label: "Priorità" },
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

interface Props {
  tab: string;
}

export function OutreachFilterSlot({ tab }: Props) {
  const g = useGlobalFilters();

  const isCockpit = tab === "cockpit";
  const isWorkspace = tab === "workspace";
  const isInUscita = tab === "inuscita";
  const isInbox = ["email", "whatsapp", "linkedin"].includes(tab);

  const toggleWs = (key: WorkspaceFilterKey) => {
    const next = new Set(g.filters.workspaceFilters);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setWorkspaceFilters(next);
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

      {/* Cockpit: sort + origin */}
      {isCockpit && (
        <>
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
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Database className="w-3 h-3" /> Origine
            </label>
            <div className="flex flex-wrap gap-1">
              {["wca", "import", "report_aziende"].map(o => (
                <Chip key={o} active={g.filters.origin.has(o)} onClick={() => {
                  const next = new Set(g.filters.origin);
                  if (next.has(o)) { if (next.size > 1) next.delete(o); } else next.add(o);
                  g.setOrigin(next);
                }}>{o === "report_aziende" ? "RA" : o.toUpperCase()}</Chip>
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

      {/* Inbox: minimal, just search */}
      {isInbox && (
        <p className="text-[10px] text-muted-foreground italic">Usa la ricerca per filtrare i messaggi</p>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded-md text-[10px] font-medium transition-all border",
        active
          ? "bg-primary/15 border-primary/30 text-primary"
          : "border-border/40 text-muted-foreground hover:bg-muted/40"
      )}
    >
      {children}
    </button>
  );
}

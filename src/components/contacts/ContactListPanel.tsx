import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail, Phone, Search, Megaphone, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, ChevronDown, MessageCircle, User, Building2, Sparkles
} from "lucide-react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { ContactFiltersBar } from "./ContactFiltersBar";
import { useContacts, useContactFilterOptions, type ContactFilters, type LeadStatus } from "@/hooks/useContacts";
import { useSelection } from "@/hooks/useSelection";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

/* ── helpers ── */

function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t === "" || t.toUpperCase() === "NULL") return null;
  return t;
}

function countryFlag(country: string | null): string {
  if (!country) return "🌍";
  const code = country.trim().toUpperCase().slice(0, 2);
  if (code.length !== 2) return "🌍";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function formatPhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}

/* ── group logic ── */

interface Group {
  key: string;
  label: string;
  items: any[];
}

function groupContacts(contacts: any[], groupBy: string): Group[] {
  const map: Record<string, Group> = {};

  contacts.forEach((c) => {
    let key: string;
    let label: string;

    switch (groupBy) {
      case "origin":
        key = clean(c.origin) || "Sconosciuta";
        label = key;
        break;
      case "status":
        key = c.lead_status || "new";
        label = key === "new" ? "Nuovo" : key === "contacted" ? "Contattato" : key === "in_progress" ? "In corso" : key === "negotiation" ? "Trattativa" : key === "converted" ? "Cliente" : key === "lost" ? "Perso" : key;
        break;
      case "date":
        key = c.created_at ? format(new Date(c.created_at), "yyyy-MM") : "nd";
        label = key === "nd" ? "Senza data" : format(new Date(c.created_at), "MMMM yyyy");
        break;
      default:
        key = clean(c.country) || "??";
        label = clean(c.country) || "Sconosciuto";
    }

    if (!map[key]) map[key] = { key, label, items: [] };
    map[key].items.push(c);
  });

  return Object.values(map).sort((a, b) => b.items.length - a.items.length);
}

/* ── group stats ── */

interface GroupStats {
  total: number;
  withEmail: number;
  withPhone: number;
  withDeepSearch: number;
  withAlias: number;
}

function calcStats(items: any[]): GroupStats {
  let withEmail = 0, withPhone = 0, withDeepSearch = 0, withAlias = 0;
  for (const c of items) {
    if (clean(c.email)) withEmail++;
    if (clean(c.phone) || clean(c.mobile)) withPhone++;
    if (c.deep_search_at) withDeepSearch++;
    if (clean(c.company_alias)) withAlias++;
  }
  return { total: items.length, withEmail, withPhone, withDeepSearch, withAlias };
}

/* ── contact quality ── */

function getContactQuality(c: any): "good" | "partial" | "poor" {
  const has = (v: any) => !!clean(v);
  const fields = [has(c.company_name), has(c.name), has(c.email), has(c.phone || c.mobile), has(c.country)];
  const filled = fields.filter(Boolean).length;
  if (filled >= 4) return "good";
  if (filled >= 2) return "partial";
  return "poor";
}

/* ── contact card ── */

function ContactCard({ c, isActive, isSelected, onSelect, onToggle }: {
  c: any;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const cName = clean(c.company_name);
  const cContact = clean(c.name);
  const cEmail = clean(c.email);
  const cPhone = clean(c.phone);
  const cMobile = clean(c.mobile);
  const cPosition = clean(c.position);
  const quality = getContactQuality(c);
  const displayCompany = cName || "Senza azienda";
  const waPhone = cMobile || cPhone;

  return (
    <div
      className={`group relative rounded-lg border p-2.5 text-xs cursor-pointer transition-all ${
        isActive
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : isSelected
          ? "border-primary/30 bg-primary/3"
          : "border-border hover:border-primary/30 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          className="mt-0.5"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0 space-y-1">
          {/* Company name */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-primary/60 shrink-0" />
            <span className={`font-bold truncate ${!cName ? "text-muted-foreground italic" : "text-foreground"}`}>
              {displayCompany}
            </span>
            {quality === "poor" && (
              <span title="Dati incompleti"><AlertTriangle className="w-3 h-3 text-destructive shrink-0" /></span>
            )}
          </div>

          {/* Contact name + position */}
          {cContact && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="w-3 h-3 shrink-0 text-muted-foreground/60" />
              <span className="truncate">{cContact}</span>
              {cPosition && <span className="text-[10px] text-primary/70">• {cPosition}</span>}
            </div>
          )}

          {/* Communication links */}
          <div className="flex items-center gap-2 pt-0.5">
            {cEmail && (
              <a
                href={`mailto:${cEmail}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                title={cEmail}
              >
                <Mail className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{cEmail}</span>
              </a>
            )}
            {waPhone && (
              <a
                href={`https://wa.me/${formatPhone(waPhone)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] text-success hover:text-success/80 transition-colors"
                title={`WhatsApp: ${waPhone}`}
              >
                <MessageCircle className="w-3 h-3" />
                <span>WA</span>
              </a>
            )}
            {cPhone && (
              <a
                href={`tel:${cPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                title={cPhone}
              >
                <Phone className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{cPhone}</span>
              </a>
            )}
          </div>
        </div>

        {/* Holding pattern on the right */}
        <div className="shrink-0">
          <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
        </div>
      </div>
    </div>
  );
}

/* ── group strip (accordion header) ── */

function GroupStrip({ group, groupBy, isOpen, onToggle, onDeepSearch, onAlias }: {
  group: Group;
  groupBy: string;
  isOpen: boolean;
  onToggle: () => void;
  onDeepSearch: () => void;
  onAlias: () => void;
}) {
  const stats = useMemo(() => calcStats(group.items), [group.items]);

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-sm">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
        onClick={onToggle}
      >
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />

        {groupBy === "country" && (
          <span className="text-sm shrink-0">{countryFlag(group.key)}</span>
        )}

        <span className="text-xs font-semibold uppercase tracking-wide text-foreground truncate">
          {group.label}
        </span>

        {/* Inline counters */}
        <div className="flex items-center gap-2 ml-auto shrink-0 text-[10px] text-muted-foreground">
          {stats.withEmail > 0 && (
            <span className="flex items-center gap-0.5" title={`${stats.withEmail} con email`}>
              <Mail className="w-3 h-3" />{stats.withEmail}
            </span>
          )}
          {stats.withPhone > 0 && (
            <span className="flex items-center gap-0.5" title={`${stats.withPhone} con telefono`}>
              <Phone className="w-3 h-3" />{stats.withPhone}
            </span>
          )}
          {stats.withDeepSearch > 0 && (
            <span className="flex items-center gap-0.5 text-success" title={`${stats.withDeepSearch} deep search`}>
              <Search className="w-3 h-3" />{stats.withDeepSearch}
            </span>
          )}
          {stats.withAlias > 0 && (
            <span className="flex items-center gap-0.5 text-primary" title={`${stats.withAlias} con alias`}>
              <Sparkles className="w-3 h-3" />{stats.withAlias}
            </span>
          )}
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            {stats.total}
          </Badge>
        </div>
      </button>

      {/* Group actions row — visible only when expanded */}
      {isOpen && (
        <div className="flex items-center gap-1 px-3 pb-1.5 text-[10px]">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] gap-1 px-1.5"
            onClick={(e) => { e.stopPropagation(); onDeepSearch(); }}
          >
            <Search className="w-3 h-3" /> Deep Search
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] gap-1 px-1.5"
            onClick={(e) => { e.stopPropagation(); onAlias(); }}
          >
            <Sparkles className="w-3 h-3" /> Alias
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── main panel ── */

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ContactListPanel({ selectedId, onSelect }: Props) {
  const [filters, setFilters] = useState<ContactFilters>({ groupBy: "country", page: 0 });
  const { data, isLoading } = useContacts(filters);
  const { data: filterOptions } = useContactFilterOptions();
  const contacts = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const page = data?.page ?? 0;
  const pageSize = data?.pageSize ?? 200;
  const totalPages = Math.ceil(totalCount / pageSize);

  const selection = useSelection(contacts);

  const countries = filterOptions?.countries ?? [];
  const origins = filterOptions?.origins ?? [];

  const groups = useMemo(() => groupContacts(contacts, filters.groupBy || "country"), [contacts, filters.groupBy]);

  // Collapsed by default — track open groups
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleFilterChange = (partial: Partial<ContactFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial, page: 0 }));
    setOpenGroups(new Set()); // reset open groups on filter change
  };

  const goToPage = (p: number) => {
    setFilters((prev) => ({ ...prev, page: p }));
    setOpenGroups(new Set());
  };

  const handleGroupDeepSearch = (group: Group) => {
    const ids = group.items.map((c: any) => c.id);
    toast({ title: `Deep Search avviata su ${ids.length} contatti del gruppo "${group.label}"` });
    // TODO: connect to actual deep search bulk action
  };

  const handleGroupAlias = (group: Group) => {
    const ids = group.items.map((c: any) => c.id);
    toast({ title: `Generazione alias per ${ids.length} contatti del gruppo "${group.label}"` });
    // TODO: connect to actual alias generation
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <ContactFiltersBar
        filters={filters}
        onChange={handleFilterChange}
        countries={countries}
        origins={origins}
      />

      {/* Bulk actions */}
      {selection.count > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/5 border-b border-border text-xs">
          <span className="font-medium">{selection.count} selezionati</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
            <Search className="w-3 h-3" /> Deep Search
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
            <Megaphone className="w-3 h-3" /> Campagna
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
            <RefreshCw className="w-3 h-3" /> Status
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={selection.clear}>
            Deseleziona
          </Button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun contatto trovato
          </p>
        ) : (
          groups.map((group) => {
            const isOpen = openGroups.has(group.key);
            return (
              <div key={group.key}>
                <GroupStrip
                  group={group}
                  groupBy={filters.groupBy || "country"}
                  isOpen={isOpen}
                  onToggle={() => toggleGroup(group.key)}
                  onDeepSearch={() => handleGroupDeepSearch(group)}
                  onAlias={() => handleGroupAlias(group)}
                />
                {isOpen && (
                  <div className="p-2 space-y-1">
                    {group.items.map((c: any) => (
                      <ContactCard
                        key={c.id}
                        c={c}
                        isActive={selectedId === c.id}
                        isSelected={selection.selectedIds.has(c.id)}
                        onSelect={() => onSelect(c.id)}
                        onToggle={() => selection.toggle(c.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer with pagination */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground">
        <span>{totalCount} contatti • {groups.length} gruppi</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <span className="text-[10px]">{page + 1}/{totalPages}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={page >= totalPages - 1}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

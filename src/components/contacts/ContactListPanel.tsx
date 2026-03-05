import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Search, Megaphone, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { ContactFiltersBar } from "./ContactFiltersBar";
import { useContacts, useContactFilterOptions, type ContactFilters, type LeadStatus } from "@/hooks/useContacts";
import { useSelection } from "@/hooks/useSelection";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

/** Treat literal "NULL"/"null" strings as actual null */
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

/** Returns a quality level for the contact record */
function getContactQuality(c: any): "good" | "partial" | "poor" {
  const has = (v: any) => !!clean(v);
  const fields = [has(c.company_name), has(c.name), has(c.email), has(c.phone || c.mobile), has(c.country)];
  const filled = fields.filter(Boolean).length;
  if (filled >= 4) return "good";
  if (filled >= 2) return "partial";
  return "poor";
}

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

  const handleFilterChange = (partial: Partial<ContactFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial, page: 0 }));
  };

  const goToPage = (p: number) => {
    setFilters((prev) => ({ ...prev, page: p }));
  };

  return (
    <div className="flex flex-col h-full">
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
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun contatto trovato
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-muted/80 backdrop-blur-sm border-b border-border">
                {filters.groupBy === "country" && (
                  <span className="text-sm">{countryFlag(group.key)}</span>
                )}
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto">
                  {group.items.length}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {group.items.map((c: any) => {
                  const isActive = selectedId === c.id;
                  const quality = getContactQuality(c);
                  const cName = clean(c.company_name);
                  const cContact = clean(c.name);
                  const cEmail = clean(c.email);
                  const cPhone = clean(c.phone);
                  const cMobile = clean(c.mobile);
                  const cPosition = clean(c.position);
                  const cCountry = clean(c.country);
                  const displayName = cName || cContact || cEmail || "Senza nome";
                  const isAnonymous = !cName && !cContact;

                  return (
                    <div
                      key={c.id}
                      className={`group relative rounded-lg border p-2 text-xs cursor-pointer transition-all ${
                        isActive
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : selection.selectedIds.has(c.id)
                          ? "border-primary/30 bg-primary/3"
                          : "border-border hover:border-primary/30 hover:shadow-sm"
                      }`}
                      onClick={() => onSelect(c.id)}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={selection.selectedIds.has(c.id)}
                          onCheckedChange={() => selection.toggle(c.id)}
                          className="mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {filters.groupBy !== "country" && (
                              <span className="text-sm">{countryFlag(cCountry)}</span>
                            )}
                            <span className={`font-semibold truncate ${isAnonymous ? "text-muted-foreground italic" : "text-foreground"}`}>
                              {displayName}
                            </span>
                            {quality === "poor" && (
                              <span title="Dati incompleti"><AlertTriangle className="w-3 h-3 text-destructive shrink-0" /></span>
                            )}
                          </div>
                          {cName && cContact && (
                            <div className="text-muted-foreground truncate">
                              {cContact}
                              {cPosition && <span className="ml-1 text-[10px] text-primary/70">• {cPosition}</span>}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {cEmail && <span className="truncate max-w-[120px]" title={cEmail}>✉ {cEmail}</span>}
                            {cPhone && <span className="truncate max-w-[80px]" title={cPhone}>☎ {cPhone}</span>}
                          </div>
                          <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
                        </div>
                      </div>

                      {/* Hover actions */}
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {cEmail && (
                          <Button variant="ghost" size="icon" className="h-5 w-5" title="Email">
                            <Mail className="w-3 h-3" />
                          </Button>
                        )}
                        {(cPhone || cMobile) && (
                          <Button variant="ghost" size="icon" className="h-5 w-5" title="Chiama">
                            <Phone className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
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

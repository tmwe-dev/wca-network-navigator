import { useState, useMemo, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail, Phone, Search, Megaphone, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, ChevronDown, MessageCircle, User, Building2, Sparkles, Loader2,
  MapPin, Tag, ArrowUpAZ, ArrowDownAZ
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveCountryCode, getCountryFlag } from "@/lib/countries";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { ContactFiltersBar } from "./ContactFiltersBar";
import { useContactFilterOptions, useUpdateLeadStatus, type ContactFilters, type LeadStatus } from "@/hooks/useContacts";
import { useContactGroupCounts, useContactsByGroup, type ContactGroupCount } from "@/hooks/useContactGroups";
import { useSelection } from "@/hooks/useSelection";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { AICommand } from "./ContactAIBar";

/* ── helpers ── */

function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t === "" || t.toUpperCase() === "NULL") return null;
  return t;
}

function countryFlag(country: string | null): string {
  if (!country) return "🌍";
  const code = resolveCountryCode(country);
  if (!code) return "🌍";
  return getCountryFlag(code);
}

function formatPhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
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

/* ── sorting ── */
type SortKey = "name" | "company" | "city" | "date";

function sortContacts(contacts: any[], sortKey: SortKey): any[] {
  const sorted = [...contacts];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "company":
        return (a.company_name || "").localeCompare(b.company_name || "");
      case "name":
        return (a.name || "").localeCompare(b.name || "");
      case "city":
        return (a.city || "").localeCompare(b.city || "");
      case "date":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
  return sorted;
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
  const cCity = clean(c.city);
  const cZip = clean(c.zip_code);
  const cOrigin = clean(c.origin);
  const quality = getContactQuality(c);
  const displayCompany = cName || "Senza azienda";
  const waPhone = cMobile || cPhone;
  const cityDisplay = [cCity, cZip].filter(Boolean).join(", ");

  return (
    <div
      className={`group relative rounded-lg border p-2.5 text-xs cursor-pointer transition-all ${
        isActive
          ? "border-primary bg-primary/15 shadow-md"
          : isSelected
          ? "border-primary/40 bg-primary/10 shadow-sm"
          : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
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
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-primary shrink-0" />
            <span className={`font-bold truncate ${!cName ? "text-muted-foreground italic" : "text-foreground"}`}>
              {displayCompany}
            </span>
            {quality === "poor" && (
              <span title="Dati incompleti"><AlertTriangle className="w-3 h-3 text-destructive shrink-0" /></span>
            )}
          </div>
          {cContact && (
            <div className="flex items-center gap-1.5 text-foreground">
              <User className="w-3 h-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{cContact}</span>
              {cPosition && <span className="text-[10px] text-primary font-medium">• {cPosition}</span>}
            </div>
          )}
          {(cityDisplay || cOrigin) && (
            <div className="flex items-center gap-2 text-foreground">
              {cityDisplay && (
                <span className="inline-flex items-center gap-1 text-[10px]">
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{cityDisplay}</span>
                </span>
              )}
              {cOrigin && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary font-semibold border-0">
                  <Tag className="w-2.5 h-2.5 mr-0.5" />{cOrigin}
                </Badge>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 pt-0.5">
            {cEmail && (
              <a href={`mailto:${cEmail}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] text-foreground hover:text-primary transition-colors font-medium" title={cEmail}>
                <Mail className="w-3 h-3" /><span className="truncate max-w-[100px]">{cEmail}</span>
              </a>
            )}
            {waPhone && (
              <a href={`https://wa.me/${formatPhone(waPhone)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] text-success hover:text-success/80 transition-colors font-medium" title={`WhatsApp: ${waPhone}`}>
                <MessageCircle className="w-3 h-3" /><span>WA</span>
              </a>
            )}
            {cPhone && (
              <a href={`tel:${cPhone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] text-foreground hover:text-primary transition-colors" title={cPhone}>
                <Phone className="w-3 h-3" /><span className="truncate max-w-[80px]">{cPhone}</span>
              </a>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border/50 pt-1 mt-1">
            <HoldingPatternIndicator status={c.lead_status as LeadStatus} compact />
            {c.interaction_count > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-chart-3/20 text-chart-3">
                <MessageCircle className="w-3 h-3" />{c.interaction_count}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                <MessageCircle className="w-3 h-3" />0
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── group strip ── */

function GroupStrip({ group, groupBy, isOpen, onToggle, onDeepSearch, onAlias, isGroupSelected, onToggleGroupSelect }: {
  group: ContactGroupCount;
  groupBy: string;
  isOpen: boolean;
  onToggle: () => void;
  onDeepSearch: () => void;
  onAlias: () => void;
  isGroupSelected: boolean;
  onToggleGroupSelect: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-muted backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <Checkbox
          checked={isGroupSelected}
          onCheckedChange={onToggleGroupSelect}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
        <button
          className="flex-1 flex items-center gap-2 text-left hover:bg-accent/50 rounded transition-colors -mx-1 px-1"
          onClick={onToggle}
        >
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />

          {groupBy === "country" && (
            <span className="text-sm shrink-0">{countryFlag(group.group_key)}</span>
          )}

          <span className="text-xs font-bold uppercase tracking-wide text-foreground truncate">
            {group.group_label}
          </span>

          {/* Inline counters */}
          <div className="flex items-center gap-2 ml-auto shrink-0 text-[10px] text-muted-foreground">
            {group.with_email > 0 && (
              <span className="flex items-center gap-0.5" title={`${group.with_email} con email`}>
                <Mail className="w-3 h-3" />{group.with_email}
              </span>
            )}
            {group.with_phone > 0 && (
              <span className="flex items-center gap-0.5" title={`${group.with_phone} con telefono`}>
                <Phone className="w-3 h-3" />{group.with_phone}
              </span>
            )}
            {group.with_deep_search > 0 && (
              <span className="flex items-center gap-0.5 text-success" title={`${group.with_deep_search} deep search`}>
                <Search className="w-3 h-3" />{group.with_deep_search}
              </span>
            )}
            {group.with_alias > 0 && (
              <span className="flex items-center gap-0.5 text-primary" title={`${group.with_alias} con alias`}>
                <Sparkles className="w-3 h-3" />{group.with_alias}
              </span>
            )}
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-bold">
              {group.contact_count}
            </Badge>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="flex items-center gap-1 px-3 pb-1.5 text-[10px]">
          <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1.5" onClick={(e) => { e.stopPropagation(); onDeepSearch(); }}>
            <Search className="w-3 h-3" /> Deep Search
          </Button>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1.5" onClick={(e) => { e.stopPropagation(); onAlias(); }}>
            <Sparkles className="w-3 h-3" /> Alias
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── expanded group content ── */

function ExpandedGroupContent({ groupType, groupKey, selectedId, onSelect, selection, holdingPattern, sortKey }: {
  groupType: string;
  groupKey: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  selection: ReturnType<typeof useSelection>;
  holdingPattern?: "out" | "in" | "all";
  sortKey: SortKey;
}) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useContactsByGroup(groupType, groupKey, page, 200, true, holdingPattern);
  const rawContacts = data?.items ?? [];
  const contacts = useMemo(() => sortContacts(rawContacts, sortKey), [rawContacts, sortKey]);
  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 200;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (isLoading) {
    return (
      <div className="p-2 space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {contacts.map((c: any) => (
        <ContactCard
          key={c.id}
          c={c}
          isActive={selectedId === c.id}
          isSelected={selection.selectedIds.has(c.id)}
          onSelect={() => onSelect(c.id)}
          onToggle={() => selection.toggle(c.id)}
        />
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1 text-[10px] text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <span>{page + 1}/{totalPages}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-3 h-3" />
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
  const [filters, setFilters] = useState<ContactFilters>({ groupBy: "country", holdingPattern: "out" });
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const { data: filterOptions } = useContactFilterOptions();
  const { data: allGroupCounts, isLoading: groupsLoading } = useContactGroupCounts();

  const countries = filterOptions?.countries ?? [];
  const origins = filterOptions?.origins ?? [];

  // Filter groups by current groupBy
  const currentGroupBy = filters.groupBy || "country";
  const groups = useMemo(() => {
    if (!allGroupCounts) return [];
    return allGroupCounts
      .filter((g) => g.group_type === currentGroupBy)
      .sort((a, b) => b.contact_count - a.contact_count);
  }, [allGroupCounts, currentGroupBy]);

  const totalContacts = useMemo(() => groups.reduce((s, g) => s + g.contact_count, 0), [groups]);

  const selection = useSelection([]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  // Track which groups have been "group-selected" (all IDs fetched + added)
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleFilterChange = (partial: Partial<ContactFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial, page: 0 }));
    setOpenGroups(new Set());
  };

  const handleGroupDeepSearch = (group: ContactGroupCount) => {
    toast({ title: `Deep Search avviata su ${group.contact_count} contatti del gruppo "${group.group_label}"` });
  };

  const handleGroupAlias = (group: ContactGroupCount) => {
    toast({ title: `Generazione alias per ${group.contact_count} contatti del gruppo "${group.group_label}"` });
  };

  /** Select/deselect all contacts in a group by fetching their IDs */
  const handleToggleGroupSelect = useCallback(async (group: ContactGroupCount) => {
    const key = `${currentGroupBy}:${group.group_key}`;
    if (selectedGroups.has(key)) {
      // Deselect - we need to remove those IDs. Fetch them again (or track them).
      // For simplicity, fetch IDs to remove
      setSelectedGroups((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      // We can't easily know which IDs to remove without tracking, so just clear and re-add others
      // For a simpler approach, fetch all IDs for this group and remove them
      const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, filters.holdingPattern);
      selection.removeBatch(ids);
    } else {
      // Select all contacts in group
      setSelectedGroups((prev) => new Set(prev).add(key));
      const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, filters.holdingPattern);
      selection.addBatch(ids);
      // Also open the group
      setOpenGroups((prev) => new Set(prev).add(group.group_key));
    }
  }, [currentGroupBy, selectedGroups, selection, filters.holdingPattern]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <ContactFiltersBar
        filters={filters}
        onChange={handleFilterChange}
        countries={countries}
        origins={origins}
        groupCounts={allGroupCounts}
      />

      {/* Sort bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/50">
        <ArrowUpAZ className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ordina:</span>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-6 text-[10px] w-auto min-w-[100px] border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="company">Azienda A→Z</SelectItem>
            <SelectItem value="name">Nome A→Z</SelectItem>
            <SelectItem value="city">Città A→Z</SelectItem>
            <SelectItem value="date">Data ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selection.count > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/10 border-b border-primary/20 text-xs">
          <span className="font-bold text-primary">{selection.count} selezionati</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><Search className="w-3 h-3" /> Deep Search</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><Megaphone className="w-3 h-3" /> Campagna</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><RefreshCw className="w-3 h-3" /> Status</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto text-destructive hover:text-destructive" onClick={() => { selection.clear(); setSelectedGroups(new Set()); }}>Deseleziona</Button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {groupsLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun contatto trovato
          </p>
        ) : (
          groups.map((group) => {
            const isOpen = openGroups.has(group.group_key);
            const groupSelKey = `${currentGroupBy}:${group.group_key}`;
            return (
              <div key={group.group_key}>
                <GroupStrip
                  group={group}
                  groupBy={currentGroupBy}
                  isOpen={isOpen}
                  onToggle={() => toggleGroup(group.group_key)}
                  onDeepSearch={() => handleGroupDeepSearch(group)}
                  onAlias={() => handleGroupAlias(group)}
                  isGroupSelected={selectedGroups.has(groupSelKey)}
                  onToggleGroupSelect={() => handleToggleGroupSelect(group)}
                />
                {isOpen && (
                  <ExpandedGroupContent
                    groupType={currentGroupBy}
                    groupKey={group.group_key}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    selection={selection}
                    holdingPattern={filters.holdingPattern}
                    sortKey={sortKey}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground">
        <span>{totalContacts} contatti • {groups.length} gruppi</span>
      </div>
    </div>
  );
}

/** Fetch all contact IDs for a given group (up to 1000) */
async function fetchGroupContactIds(
  groupType: string,
  groupKey: string,
  holdingPattern?: "out" | "in" | "all"
): Promise<string[]> {
  let q = supabase
    .from("imported_contacts")
    .select("id")
    .or("company_name.not.is.null,name.not.is.null,email.not.is.null");

  if (holdingPattern === "out") q = q.eq("interaction_count", 0);
  else if (holdingPattern === "in") q = q.gt("interaction_count", 0);

  switch (groupType) {
    case "country":
      if (groupKey === "??" || groupKey === "Sconosciuto") q = q.is("country", null);
      else q = q.eq("country", groupKey);
      break;
    case "origin":
      if (groupKey === "Sconosciuta") q = q.is("origin", null);
      else q = q.eq("origin", groupKey);
      break;
    case "status":
      q = q.eq("lead_status", groupKey);
      break;
    case "date":
      if (groupKey === "nd") {
        q = q.is("created_at", null);
      } else {
        const [y, m] = groupKey.split("-").map(Number);
        const nextM = new Date(y, m, 1).toISOString();
        q = q.gte("created_at", `${groupKey}-01T00:00:00Z`).lt("created_at", nextM);
      }
      break;
  }

  q = q.limit(1000);
  const { data } = await q;
  return (data ?? []).map((r: any) => r.id);
}

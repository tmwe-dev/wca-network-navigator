import { useMemo, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, User, Building2, ChevronRight, AlertTriangle } from "lucide-react";
import { useAllActivities, type AllActivity } from "@/hooks/useActivities";
import { groupByCountry } from "@/lib/groupByCountry";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";

type FilterKey = "with_email" | "no_email" | "with_contact" | "no_contact" | "with_alias" | "no_alias";

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: "with_email", label: "Con email" },
  { key: "no_email", label: "Senza email" },
  { key: "with_contact", label: "Con contatto" },
  { key: "no_contact", label: "Senza contatto" },
  { key: "with_alias", label: "Con alias" },
  { key: "no_alias", label: "Senza alias" },
];

function matchesFilter(a: AllActivity, f: FilterKey): boolean {
  const contact = a.selected_contact;
  switch (f) {
    case "with_email": return !!contact?.email;
    case "no_email": return !contact?.email;
    case "with_contact": return !!contact;
    case "no_contact": return !contact;
    case "with_alias": return !!(contact?.contact_alias || a.partners?.company_alias);
    case "no_alias": return !contact?.contact_alias && !a.partners?.company_alias;
  }
}

interface ContactListPanelProps {
  selectedActivityId: string | null;
  onSelect: (activity: AllActivity) => void;
  search?: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function ContactListPanel({
  selectedActivityId, onSelect, search = "",
  selectedIds, onToggleSelect, onSelectAll, onDeselectAll,
}: ContactListPanelProps) {
  const { data: activities, isLoading } = useAllActivities();
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());

  const emailActivities = useMemo(() => {
    if (!activities) return [];
    return activities.filter(
      (a) => a.activity_type === "send_email" && a.status !== "completed"
    );
  }, [activities]);

  const searched = useMemo(() => {
    if (!search.trim()) return emailActivities;
    const q = search.toLowerCase();
    return emailActivities.filter((a) =>
      a.partners?.company_name?.toLowerCase().includes(q) ||
      a.partners?.company_alias?.toLowerCase().includes(q) ||
      a.partners?.country_name?.toLowerCase().includes(q) ||
      a.partners?.city?.toLowerCase().includes(q) ||
      a.selected_contact?.name?.toLowerCase().includes(q) ||
      a.selected_contact?.contact_alias?.toLowerCase().includes(q)
    );
  }, [emailActivities, search]);

  const filtered = useMemo(() => {
    if (activeFilters.size === 0) return searched;
    return searched.filter((a) => {
      for (const f of activeFilters) {
        if (!matchesFilter(a, f)) return false;
      }
      return true;
    });
  }, [searched, activeFilters]);

  const filterCounts = useMemo(() => {
    const counts = {} as Record<FilterKey, number>;
    for (const chip of FILTER_CHIPS) {
      counts[chip.key] = searched.filter((a) => matchesFilter(a, chip.key)).length;
    }
    return counts;
  }, [searched]);

  const grouped = useMemo(
    () =>
      groupByCountry(
        filtered,
        (a) => a.partners?.country_code || "??",
        (a) => a.partners?.country_name || "?"
      ),
    [filtered]
  );

  const toggleFilter = useCallback((key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => setActiveFilters(new Set()), []);

  const allSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with select all */}
      <div className="px-3 py-2 border-b border-stone-200/60 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => allSelected ? onDeselectAll() : onSelectAll()}
              className="border-stone-300 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
            />
            <p className="text-[11px] text-stone-400 font-medium">
              {selectedIds.size > 0 ? (
                <span className="text-violet-600">{selectedIds.size} selezionati</span>
              ) : (
                <>{filtered.length} attività · {grouped.length} paesi</>
              )}
            </p>
          </div>
        </div>
        {/* Filter chips — combinable toggles */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={clearFilters}
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
              activeFilters.size === 0
                ? "bg-violet-100 text-violet-700"
                : "bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-500"
            )}
          >
            Tutti
          </button>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => toggleFilter(chip.key)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                activeFilters.has(chip.key)
                  ? "bg-violet-100 text-violet-700"
                  : "bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-500"
              )}
            >
              {chip.label}
              <span className="ml-1 opacity-60">{filterCounts[chip.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {grouped.map(({ countryCode, countryName, items }) => (
            <div key={countryCode} className="mb-1">
              <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                <span>{getCountryFlag(countryCode)}</span>
                <span>{countryName}</span>
                <Badge className="text-[9px] h-4 px-1.5 bg-stone-100 text-stone-500 hover:bg-stone-100 border-0">
                  {items.length}
                </Badge>
              </div>
              {items.map((activity) => {
                const isSelected = activity.id === selectedActivityId;
                const isChecked = selectedIds.has(activity.id);
                const contact = activity.selected_contact;
                const hasEmail = !!contact?.email;
                const displayName = contact?.contact_alias || contact?.name;
                const companyDisplay = activity.partners?.company_alias || activity.partners?.company_name;

                return (
                  <div
                    key={activity.id}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-lg transition-all duration-150 group",
                      "hover:bg-stone-50",
                      isSelected
                        ? "bg-violet-50/50 border border-violet-300/50 shadow-sm"
                        : "border border-transparent"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => onToggleSelect(activity.id)}
                      className="mt-1.5 border-stone-300 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                    />
                    <button
                      onClick={() => onSelect(activity)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "bg-violet-100 text-violet-600" : "bg-stone-100 text-stone-400"
                        )}>
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm text-stone-700 truncate">{companyDisplay}</span>
                          </div>
                          {contact ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3 text-stone-400" />
                              <span className="text-xs text-stone-500 truncate">
                                {displayName}
                                {contact.title && ` · ${contact.title}`}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span className="text-[11px] text-amber-500">Nessun contatto</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {hasEmail ? (
                              <Mail className="w-3 h-3 text-violet-400" />
                            ) : contact ? (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-red-300" />
                                <span className="text-[10px] text-red-400">No email</span>
                              </div>
                            ) : null}
                            {(contact?.direct_phone || contact?.mobile) && (
                              <Phone className="w-3 h-3 text-violet-400" />
                            )}
                          </div>
                        </div>
                        <ChevronRight className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-transform text-stone-300",
                          isSelected && "text-violet-400 rotate-90"
                        )} />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-sm">
              Nessuna attività email trovata
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

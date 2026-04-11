/**
 * ContactFiltersPanel — Filter sidebar for CRM
 */
import * as React from "react";
import { useCallback } from "react";
import { Button } from "../atoms/Button";
import { Badge } from "../atoms/Badge";
import { X, Filter } from "lucide-react";

const LEAD_STATUSES = ["new", "contacted", "in_progress", "negotiation", "converted", "lost"] as const;

export interface ContactFilterValues {
  readonly leadStatus?: string;
  readonly hasEmail?: boolean;
  readonly hasPhone?: boolean;
  readonly searchQuery?: string;
}

interface ContactFiltersPanelProps {
  readonly filters: ContactFilterValues;
  readonly onFiltersChange: (filters: ContactFilterValues) => void;
}

export function ContactFiltersPanel({
  filters,
  onFiltersChange,
}: ContactFiltersPanelProps): React.ReactElement {
  const updateFilter = useCallback(
    <K extends keyof ContactFilterValues>(key: K, value: ContactFilterValues[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange],
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const activeCount = Object.values(filters).filter((v) => v !== undefined && v !== "").length;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4" />
          Filtri
          {activeCount > 0 ? <Badge variant="secondary" className="text-xs">{activeCount}</Badge> : null}
        </div>
        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3 w-3 mr-1" /> Reset
          </Button>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground font-medium">Stato lead</label>
        <select
          className="w-full h-8 text-sm rounded border bg-background px-2"
          value={filters.leadStatus ?? ""}
          onChange={(e) => updateFilter("leadStatus", e.target.value || undefined)}
        >
          <option value="">Tutti</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground font-medium">Qualità dati</label>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasEmail ?? false}
              onChange={(e) => updateFilter("hasEmail", e.target.checked || undefined)}
              className="rounded"
            />
            Con email
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasPhone ?? false}
              onChange={(e) => updateFilter("hasPhone", e.target.checked || undefined)}
              className="rounded"
            />
            Con telefono
          </label>
        </div>
      </div>
    </div>
  );
}

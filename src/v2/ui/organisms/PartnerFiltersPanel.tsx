/**
 * PartnerFiltersPanel — Sidebar filters for NetworkPage
 * Country multi-select, network filter, quality filter
 */
import * as React from "react";
import { useState, useCallback } from "react";
import { Input } from "../atoms/Input";
import { Button } from "../atoms/Button";
import { Badge } from "../atoms/Badge";
import { X, Filter } from "lucide-react";

export interface PartnerFilterValues {
  readonly countryCode?: string;
  readonly networkName?: string;
  readonly hasEmail?: boolean;
  readonly hasPhone?: boolean;
  readonly searchQuery?: string;
}

interface PartnerFiltersPanelProps {
  readonly filters: PartnerFilterValues;
  readonly onFiltersChange: (filters: PartnerFilterValues) => void;
  readonly availableCountries?: readonly string[];
  readonly availableNetworks?: readonly string[];
}

export function PartnerFiltersPanel({
  filters,
  onFiltersChange,
  availableCountries = [],
  availableNetworks = [],
}: PartnerFiltersPanelProps): React.ReactElement {
  const [countryInput, setCountryInput] = useState("");

  const updateFilter = useCallback(
    <K extends keyof PartnerFilterValues>(key: K, value: PartnerFilterValues[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange],
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const activeCount = Object.values(filters).filter((v) => v !== undefined && v !== "").length;

  const filteredCountries = availableCountries.filter(
    (c) => c.toLowerCase().includes(countryInput.toLowerCase()),
  ).slice(0, 20);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4" />
          Filtri
          {activeCount > 0 ? (
            <Badge variant="secondary" className="text-xs">{activeCount}</Badge>
          ) : null}
        </div>
        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3 w-3 mr-1" /> Reset
          </Button>
        ) : null}
      </div>

      {/* Country filter */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground font-medium">Paese</label>
        <Input
          placeholder="Cerca paese..."
          value={countryInput}
          onChange={(e) => setCountryInput(e.target.value)}
          className="h-8 text-sm"
        />
        {countryInput && filteredCountries.length > 0 ? (
          <div className="max-h-32 overflow-y-auto border rounded p-1 space-y-0.5">
            {filteredCountries.map((country) => (
              <button
                key={country}
                onClick={() => {
                  updateFilter("countryCode", country);
                  setCountryInput("");
                }}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
              >
                {country}
              </button>
            ))}
          </div>
        ) : null}
        {filters.countryCode ? (
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {filters.countryCode}
              <button className="ml-1" onClick={() => updateFilter("countryCode", undefined)}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          </div>
        ) : null}
      </div>

      {/* Network filter */}
      {availableNetworks.length > 0 ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Network</label>
          <select
            className="w-full h-8 text-sm rounded border bg-background px-2"
            value={filters.networkName ?? ""}
            onChange={(e) => updateFilter("networkName", e.target.value || undefined)}
          >
            <option value="">Tutti</option>
            {availableNetworks.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Quality filters */}
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

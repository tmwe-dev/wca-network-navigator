/**
 * PartnerFiltersPanel — Advanced sidebar filters for NetworkPage
 * Supports: country, city, partner type, quality, favorites, sort
 */
import * as React from "react";
import { useState, useCallback } from "react";
import { Input } from "../atoms/Input";
import { Button } from "../atoms/Button";
import { Badge } from "../atoms/Badge";
import { X, Filter, Star, ArrowUpDown } from "lucide-react";

export interface PartnerFilterValues {
  readonly countryCode?: string;
  readonly city?: string;
  readonly partnerType?: string;
  readonly hasEmail?: boolean;
  readonly hasPhone?: boolean;
  readonly favorites?: boolean;
  readonly quality?: "with_email" | "with_phone" | "with_profile" | "no_email";
  readonly sort?: "name" | "rating" | "recent";
  readonly searchQuery?: string;
}

interface Props {
  readonly filters: PartnerFilterValues;
  readonly onFiltersChange: (filters: PartnerFilterValues) => void;
  readonly availableCountries?: readonly string[];
  readonly availableCities?: readonly string[];
  readonly availableTypes?: readonly string[];
}

const QUALITY_OPTIONS = [
  { value: "with_email" as const, label: "Con email" },
  { value: "with_phone" as const, label: "Con telefono" },
  { value: "with_profile" as const, label: "Con profilo" },
  { value: "no_email" as const, label: "Senza email" },
];

const SORT_OPTIONS = [
  { value: "name" as const, label: "Nome" },
  { value: "rating" as const, label: "Rating" },
  { value: "recent" as const, label: "Recenti" },
];

const TYPE_LABELS: Record<string, string> = {
  freight_forwarder: "Freight Forwarder",
  customs_broker: "Customs Broker",
  nvocc: "NVOCC",
  carrier: "Carrier",
  courier: "Courier",
  "3pl": "3PL",
};

export function PartnerFiltersPanel({
  filters, onFiltersChange,
  availableCountries = [], availableCities = [], availableTypes = [],
}: Props): React.ReactElement {
  const [countryInput, setCountryInput] = useState("");
  const [cityInput, setCityInput] = useState("");

  const update = useCallback(
    <K extends keyof PartnerFilterValues>(key: K, value: PartnerFilterValues[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange],
  );

  const clearAll = useCallback(() => onFiltersChange({}), [onFiltersChange]);

  const activeCount = Object.values(filters).filter((v) => v !== undefined && v !== "" && v !== false).length;

  const filteredCountries = availableCountries
    .filter((c) => c.toLowerCase().includes(countryInput.toLowerCase()))
    .slice(0, 15);

  const filteredCities = availableCities
    .filter((c) => c.toLowerCase().includes(cityInput.toLowerCase()))
    .slice(0, 15);

  return (
    <div className="space-y-4 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4" />
          Filtri
          {activeCount > 0 && <Badge variant="secondary" className="text-xs">{activeCount}</Badge>}
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="h-3 w-3 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Sort */}
      <Section label="Ordina per" icon={<ArrowUpDown className="h-3 w-3" />}>
        <div className="flex flex-wrap gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update("sort", filters.sort === opt.value ? undefined : opt.value)}
              className={`text-xs px-2 py-1 rounded border ${
                filters.sort === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Favorites */}
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={filters.favorites ?? false}
          onChange={(e) => update("favorites", e.target.checked || undefined)}
          className="rounded"
        />
        <Star className="h-3 w-3 text-yellow-500" />
        Solo preferiti
      </label>

      {/* Country */}
      <Section label="Paese">
        <AutocompleteFilter
          input={countryInput}
          setInput={setCountryInput}
          placeholder="Cerca paese..."
          suggestions={filteredCountries}
          selected={filters.countryCode}
          onSelect={(v) => { update("countryCode", v); setCountryInput(""); }}
          onClear={() => update("countryCode", undefined)}
        />
      </Section>

      {/* City */}
      <Section label="Città">
        <AutocompleteFilter
          input={cityInput}
          setInput={setCityInput}
          placeholder="Cerca città..."
          suggestions={filteredCities}
          selected={filters.city}
          onSelect={(v) => { update("city", v); setCityInput(""); }}
          onClear={() => update("city", undefined)}
        />
      </Section>

      {/* Partner type */}
      {availableTypes.length > 0 && (
        <Section label="Tipo partner">
          <div className="flex flex-wrap gap-1">
            {availableTypes.map((t) => (
              <button
                key={t}
                onClick={() => update("partnerType", filters.partnerType === t ? undefined : t)}
                className={`text-xs px-2 py-1 rounded border ${
                  filters.partnerType === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border"
                }`}
              >
                {TYPE_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Quality */}
      <Section label="Qualità dati">
        <div className="flex flex-wrap gap-1">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update("quality", filters.quality === opt.value ? undefined : opt.value)}
              className={`text-xs px-2 py-1 rounded border ${
                filters.quality === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ label, icon, children }: {
  readonly label: string;
  readonly icon?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
        {icon}{label}
      </label>
      {children}
    </div>
  );
}

function AutocompleteFilter({ input, setInput, placeholder, suggestions, selected, onSelect, onClear }: {
  readonly input: string;
  readonly setInput: (v: string) => void;
  readonly placeholder: string;
  readonly suggestions: readonly string[];
  readonly selected?: string;
  readonly onSelect: (v: string) => void;
  readonly onClear: () => void;
}): React.ReactElement {
  return (
    <>
      <Input
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="h-7 text-xs"
      />
      {input && suggestions.length > 0 && (
        <div className="max-h-28 overflow-y-auto border rounded p-1 space-y-0.5">
          {suggestions.map((item) => (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className="w-full text-left text-xs px-2 py-0.5 rounded hover:bg-accent"
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <Badge variant="secondary" className="text-xs">
          {selected}
          <button className="ml-1" onClick={onClear}><X className="h-2.5 w-2.5" /></button>
        </Badge>
      )}
    </>
  );
}

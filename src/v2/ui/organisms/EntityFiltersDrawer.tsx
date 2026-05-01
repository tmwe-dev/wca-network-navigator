/**
 * EntityFiltersDrawer — Drawer "⚙ Filtri" per CompanyCardList (WCA / CRM / BCA).
 *
 * Logic-less: stato filtri controllato dal consumer; le opzioni di
 * select multipli (networks/services/certifications/leadStatus) sono
 * derivate dalla lista corrente per essere sempre coerenti.
 */
import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import type {
  CompanyFiltersState,
  RecencyBucket,
  TriBool,
} from "@/v2/hooks/companyList/useCompanyFilters";
import type { CompanyEntity } from "@/v2/ui/molecules/CompanyCardList";

export interface EntityFiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CompanyFiltersState;
  onChange: (next: CompanyFiltersState) => void;
  /** Lista corrente da cui derivare le opzioni (network/services/etc.). */
  companies: CompanyEntity[];
  source: "wca" | "crm" | "bca";
}

function uniqSorted(values: Array<string | undefined | null>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v) set.add(v);
  }
  return Array.from(set).sort();
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 cursor-pointer">
      <div className="min-w-0">
        <div className="text-[12px] text-foreground">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ChipMulti({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}): React.ReactElement {
  if (options.length === 0) {
    return <div className="text-[10px] text-muted-foreground/60 italic px-1">Nessuna opzione disponibile</div>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              "h-6 px-2 rounded-full text-[10px] font-medium transition-all border",
              active
                ? "bg-primary/15 text-primary border-primary/40"
                : "bg-card/40 text-muted-foreground border-border/40 hover:border-border hover:text-foreground"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/80 px-1">{title}</div>
      {children}
    </div>
  );
}

export function EntityFiltersDrawer({
  open,
  onOpenChange,
  filters,
  onChange,
  companies,
  source,
}: EntityFiltersDrawerProps): React.ReactElement {
  const set = (patch: Partial<CompanyFiltersState>) => onChange({ ...filters, ...patch });
  const toggleArr = (key: "leadStatus" | "networks" | "services" | "certifications", v: string) => {
    const cur = filters[key] ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    set({ [key]: next } as Partial<CompanyFiltersState>);
  };

  const networkOptions = React.useMemo(
    () => uniqSorted(companies.flatMap((c) => c.networks ?? [])),
    [companies]
  );
  const serviceOptions = React.useMemo(
    () => uniqSorted(companies.flatMap((c) => c.services ?? [])),
    [companies]
  );
  const certOptions = React.useMemo(
    () => uniqSorted(companies.flatMap((c) => c.certifications ?? [])),
    [companies]
  );
  const leadStatusOptions = React.useMemo(
    () => uniqSorted(companies.map((c) => c.leadStatus)),
    [companies]
  );
  const officeTypeOptions = React.useMemo(
    () => uniqSorted(companies.map((c) => c.officeType)),
    [companies]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Filtri avanzati</span>
            <button
              type="button"
              onClick={() => onChange({})}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              title="Resetta tutti i filtri"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </SheetTitle>
          <SheetDescription className="text-[11px]">
            Tutti i filtri sono in AND. Vengono applicati alla lista già caricata.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-4 pb-10">
          <Section title="Canali e qualità dato">
            <div className="space-y-0.5">
              <ToggleRow label="Ha email" checked={!!filters.hasEmail} onChange={(v) => set({ hasEmail: v })} />
              <ToggleRow label="Ha telefono" checked={!!filters.hasPhone} onChange={(v) => set({ hasPhone: v })} />
              <ToggleRow label="Ha sito web" checked={!!filters.hasWebsite} onChange={(v) => set({ hasWebsite: v })} />
              <ToggleRow label="Ha LinkedIn" checked={!!filters.hasLinkedin} onChange={(v) => set({ hasLinkedin: v })} />
              <ToggleRow label="Ha logo" checked={!!filters.hasLogo} onChange={(v) => set({ hasLogo: v })} />
              <ToggleRow label="Ha biglietto BCA collegato" checked={!!filters.hasBca} onChange={(v) => set({ hasBca: v })} />
              <ToggleRow label="Solo preferiti ⭐" checked={!!filters.favoritesOnly} onChange={(v) => set({ favoritesOnly: v })} />
            </div>
          </Section>

          <Section title="Stato commerciale">
            <div className="grid grid-cols-3 gap-1">
              {(["any", "in", "out"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set({ holding: v })}
                  className={cn(
                    "h-7 rounded-md text-[10px] font-medium border",
                    (filters.holding ?? "any") === v
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-card/40 text-muted-foreground border-border/40 hover:text-foreground"
                  )}
                >
                  {v === "any" ? "Tutti" : v === "in" ? "✈ In attesa" : "✈ Fuori attesa"}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <div className="text-[10px] text-muted-foreground/80 pb-1">Lead status</div>
              <ChipMulti
                options={leadStatusOptions}
                selected={filters.leadStatus ?? []}
                onToggle={(v) => toggleArr("leadStatus", v)}
              />
            </div>
          </Section>

          {source === "wca" && (
            <Section title="Affiliazione WCA">
              <div>
                <div className="text-[10px] text-muted-foreground/80 pb-1">Anni in WCA</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="min"
                    className="h-7 text-xs"
                    value={filters.wcaYearsMin ?? ""}
                    onChange={(e) => set({ wcaYearsMin: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    placeholder="max"
                    className="h-7 text-xs"
                    value={filters.wcaYearsMax ?? ""}
                    onChange={(e) => set({ wcaYearsMax: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
              </div>
              {officeTypeOptions.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] text-muted-foreground/80 pb-1">Tipo ufficio</div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => set({ officeType: null })}
                      className={cn(
                        "h-7 rounded-md text-[10px] font-medium border",
                        !filters.officeType ? "bg-primary/15 text-primary border-primary/40" : "bg-card/40 text-muted-foreground border-border/40"
                      )}
                    >
                      Tutti
                    </button>
                    {officeTypeOptions.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => set({ officeType: o })}
                        className={cn(
                          "h-7 rounded-md text-[10px] font-medium border",
                          filters.officeType === o ? "bg-primary/15 text-primary border-primary/40" : "bg-card/40 text-muted-foreground border-border/40"
                        )}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {networkOptions.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] text-muted-foreground/80 pb-1">Network</div>
                  <ChipMulti options={networkOptions} selected={filters.networks ?? []} onToggle={(v) => toggleArr("networks", v)} />
                </div>
              )}
            </Section>
          )}

          <Section title="Score e attività">
            <div>
              <div className="text-[10px] text-muted-foreground/80 pb-1">Score (0-100)</div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="min"
                  className="h-7 text-xs"
                  value={filters.scoreMin ?? ""}
                  onChange={(e) => set({ scoreMin: e.target.value === "" ? null : Number(e.target.value) })}
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="number"
                  placeholder="max"
                  className="h-7 text-xs"
                  value={filters.scoreMax ?? ""}
                  onChange={(e) => set({ scoreMax: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="pt-2">
              <div className="text-[10px] text-muted-foreground/80 pb-1">Ultimo contatto</div>
              <div className="grid grid-cols-5 gap-1">
                {(["any", "lt7", "lt30", "gt90", "never"] as RecencyBucket[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => set({ recency: b })}
                    className={cn(
                      "h-7 rounded-md text-[9px] font-medium border",
                      (filters.recency ?? "any") === b ? "bg-primary/15 text-primary border-primary/40" : "bg-card/40 text-muted-foreground border-border/40"
                    )}
                    title={
                      { any: "Tutti", lt7: "Ultimi 7 giorni", lt30: "Ultimi 30 giorni", gt90: "> 90 giorni", never: "Mai contattato" }[b]
                    }
                  >
                    {{ any: "Tutti", lt7: "<7g", lt30: "<30g", gt90: ">90g", never: "Mai" }[b]}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <div className="text-[10px] text-muted-foreground/80 pb-1">Deep Search</div>
              <div className="grid grid-cols-3 gap-1">
                {(["any", "yes", "no"] as TriBool[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set({ deepSearch: v })}
                    className={cn(
                      "h-7 rounded-md text-[10px] font-medium border",
                      (filters.deepSearch ?? "any") === v ? "bg-primary/15 text-primary border-primary/40" : "bg-card/40 text-muted-foreground border-border/40"
                    )}
                  >
                    {v === "any" ? "Tutti" : v === "yes" ? "🔍 Fatto" : "Mai"}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {(serviceOptions.length > 0 || certOptions.length > 0) && (
            <Section title="Servizi & certificazioni">
              {serviceOptions.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground/80 pb-1">Servizi</div>
                  <ChipMulti options={serviceOptions} selected={filters.services ?? []} onToggle={(v) => toggleArr("services", v)} />
                </div>
              )}
              {certOptions.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] text-muted-foreground/80 pb-1">Certificazioni</div>
                  <ChipMulti options={certOptions} selected={filters.certifications ?? []} onToggle={(v) => toggleArr("certifications", v)} />
                </div>
              )}
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default EntityFiltersDrawer;
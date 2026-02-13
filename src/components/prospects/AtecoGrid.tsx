import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import {
  Search, Mail, Phone, Users, CheckCircle, SlidersHorizontal, X, FileText,
  Building2, Euro, ChevronsUpDown, Check,
} from "lucide-react";
import { useAtecoGroups } from "@/hooks/useProspectStats";
import { REGIONI_ITALIANE, PROVINCE_ITALIANE } from "@/data/italianProvinces";
import { t } from "@/components/download/theme";

interface AtecoGridProps {
  selected: string[];
  onToggle: (code: string) => void;
  onRemove: (code: string) => void;
  isDark: boolean;
  regionFilter: string[];
  onRegionChange: (r: string[]) => void;
  provinceFilter: string[];
  onProvinceChange: (p: string[]) => void;
}

function formatCurrency(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

function FilterMultiSelect({
  label, placeholder, options, selected, onToggle, onClear, isDark,
}: {
  label: string; placeholder: string;
  options: Array<{ value: string; label: string; sub?: string }>;
  selected: string[]; onToggle: (v: string) => void; onClear: () => void; isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs border transition-all ${isDark
            ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/[0.08]"
            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}>
            <span className={selected.length === 0 ? (isDark ? "text-slate-500" : "text-slate-400") : ""}>
              {selected.length === 0 ? placeholder : `${selected.length} sel.`}
            </span>
            <ChevronsUpDown className="w-3 h-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className={`w-56 p-0 ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`} align="start">
          <Command className={isDark ? "bg-slate-900" : ""}>
            <CommandInput placeholder="Cerca..." className={`text-xs ${isDark ? "text-white" : ""}`} />
            <CommandList>
              <CommandEmpty className={`text-xs ${isDark ? "text-slate-500" : ""}`}>Nessun risultato</CommandEmpty>
              {selected.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={onClear} className={`text-xs ${isDark ? "text-rose-400" : "text-rose-500"}`}>
                    <X className="w-3 h-3 mr-1" /> Deseleziona tutto
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                <ScrollArea className="max-h-48">
                  {options.map(opt => (
                    <CommandItem
                      key={opt.value}
                      value={`${opt.value} ${opt.label}`}
                      onSelect={() => onToggle(opt.value)}
                      className={`text-xs ${isDark ? "text-slate-300 aria-selected:bg-white/10" : ""}`}
                    >
                      <div className={`w-3.5 h-3.5 mr-2 rounded border flex items-center justify-center flex-shrink-0 ${
                        selectedSet.has(opt.value)
                          ? "bg-sky-500 border-sky-500"
                          : isDark ? "border-slate-600" : "border-slate-300"
                      }`}>
                        {selectedSet.has(opt.value) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span>{opt.label}</span>
                      {opt.sub && <span className={`ml-auto text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>{opt.sub}</span>}
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map(v => (
            <button key={v} onClick={() => onToggle(v)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${isDark
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/25"
                : "bg-sky-50 text-sky-700 border border-sky-200"
              }`}>
              {v} <X className="w-2.5 h-2.5 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AtecoGrid({
  selected, onToggle, onRemove, isDark,
  regionFilter, onRegionChange, provinceFilter, onProvinceChange,
}: AtecoGridProps) {
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"code" | "count" | "fatturato">("code");

  const { data: atecoGroups = [], isLoading } = useAtecoGroups();

  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter(i => i !== item) : [...list, item];

  const regionOptions = useMemo(() =>
    REGIONI_ITALIANE.map(r => ({ value: r, label: r })),
  []);

  const provinceOptions = useMemo(() => {
    const filtered = regionFilter.length > 0
      ? PROVINCE_ITALIANE.filter(p => regionFilter.includes(p.regione))
      : PROVINCE_ITALIANE;
    return filtered.map(p => ({ value: p.sigla, label: `${p.sigla} — ${p.nome}`, sub: p.regione }));
  }, [regionFilter]);

  const sections = useMemo(() => {
    let filtered = atecoGroups.filter(g => {
      const q = search.toLowerCase();
      return g.codice_ateco.toLowerCase().includes(q) || g.descrizione_ateco.toLowerCase().includes(q);
    });

    if (sortBy === "count") filtered = [...filtered].sort((a, b) => b.count - a.count);
    else if (sortBy === "fatturato") filtered = [...filtered].sort((a, b) => (b.avg_fatturato || 0) - (a.avg_fatturato || 0));

    const map = new Map<string, typeof filtered>();
    for (const g of filtered) {
      const sec = g.codice_ateco.substring(0, 2);
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(g);
    }
    return map;
  }, [atecoGroups, search, sortBy]);

  const selectedSet = new Set(selected);
  const hasActiveFilter = regionFilter.length > 0 || provinceFilter.length > 0 || sortBy !== "code";

  const sorts = [
    { key: "code" as const, label: "Codice ATECO" },
    { key: "count" as const, label: "N° prospect ↓" },
    { key: "fatturato" as const, label: "Fatturato medio ↓" },
  ];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${th.dim}`} />
          <Input
            placeholder="Cerca codice ATECO..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`pl-12 h-11 rounded-2xl text-base ${th.input}`}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button className={`relative flex items-center justify-center w-11 h-11 rounded-2xl border transition-all ${
              isDark
                ? "bg-white/[0.05] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]"
                : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white shadow-sm"
            }`}>
              <SlidersHorizontal className="w-5 h-5" />
              {hasActiveFilter && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-sky-500 border-2 border-background" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className={`w-64 p-3 rounded-2xl ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${th.dim}`}>Ordinamento</p>
            <div className="flex flex-col gap-1 mb-3">
              {sorts.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === s.key
                      ? isDark ? "bg-sky-500/20 text-sky-300" : "bg-sky-50 text-sky-700"
                      : isDark ? "text-slate-400 hover:bg-white/[0.05]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >{s.label}</button>
              ))}
            </div>

            <FilterMultiSelect
              label="Regione"
              placeholder="Tutte le regioni"
              options={regionOptions}
              selected={regionFilter}
              onToggle={v => {
                const next = toggle(regionFilter, v);
                onRegionChange(next);
                // Clear provinces not in selected regions
                if (next.length > 0) {
                  const validSigle = new Set(PROVINCE_ITALIANE.filter(p => next.includes(p.regione)).map(p => p.sigla));
                  onProvinceChange(provinceFilter.filter(s => validSigle.has(s)));
                }
              }}
              onClear={() => { onRegionChange([]); onProvinceChange([]); }}
              isDark={isDark}
            />

            <div className="mt-3">
              <FilterMultiSelect
                label="Provincia"
                placeholder="Tutte le province"
                options={provinceOptions}
                selected={provinceFilter}
                onToggle={v => onProvinceChange(toggle(provinceFilter, v))}
                onClear={() => onProvinceChange([])}
                isDark={isDark}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {selected.map(code => (
            <button
              key={code}
              onClick={() => onRemove(code)}
              className={`group flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                isDark ? "bg-sky-500/15 text-sky-300 border border-sky-500/25" : "bg-sky-50 text-sky-700 border border-sky-200"
              }`}
            >
              {code}
              <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {/* ATECO List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2 pr-2">
          {isLoading ? (
            <div className={`text-center py-12 ${th.dim}`}>Caricamento codici ATECO...</div>
          ) : sections.size === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className={`w-16 h-16 mx-auto ${isDark ? "text-white/10" : "text-slate-200"}`} />
              <p className={`text-sm ${th.sub}`}>Nessun codice ATECO trovato</p>
              <p className={`text-xs ${th.dim}`}>Importa prospect tramite l'estensione RA per popolare la griglia</p>
            </div>
          ) : (
            [...sections.entries()].map(([section, groups]) => {
              const sectionDesc = groups[0]?.descrizione_ateco?.split(" - ")[0] || "";
              const totalInSection = groups.reduce((s, g) => s + g.count, 0);

              return (
                <div key={section}>
                  <div className={`flex items-center gap-2 px-2 py-1 mb-1 ${th.dim}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{section}</span>
                    <span className="text-[10px] truncate flex-1">{sectionDesc}</span>
                    <span className="text-[10px] font-mono">{totalInSection}</span>
                  </div>

                  {groups.map(g => {
                    const isSelected = selectedSet.has(g.codice_ateco);
                    const dataDensity = g.with_email / Math.max(g.count, 1);
                    const stripeColor = dataDensity >= 0.6
                      ? "from-emerald-400 to-teal-500"
                      : dataDensity >= 0.3
                        ? "from-amber-400 to-orange-500"
                        : "from-rose-400 to-red-500";

                    const cardTint = isSelected
                      ? isDark
                        ? "bg-sky-950/60 border-sky-400/30 ring-1 ring-sky-400/20 shadow-lg shadow-sky-500/10"
                        : "bg-sky-50 border-sky-300 ring-1 ring-sky-300/50 shadow-lg shadow-sky-200/40"
                      : isDark
                        ? "bg-slate-900/40 border-slate-700/20 hover:bg-slate-800/40 hover:border-slate-600/30"
                        : "bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300";

                    return (
                      <button
                        key={g.codice_ateco}
                        onClick={() => onToggle(g.codice_ateco)}
                        className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-300 w-full mb-1.5 ${cardTint}`}
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${stripeColor} transition-all duration-300 ${
                          isSelected ? "opacity-100" : "opacity-50 group-hover:opacity-90"
                        }`} />

                        <div className="relative p-3 pl-5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-bold truncate ${th.h2}`}>{g.codice_ateco}</p>
                              <p className={`text-[11px] truncate ${th.sub}`}>{g.descrizione_ateco}</p>
                            </div>
                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              <div className="flex items-center gap-1">
                                <Mail className={`w-3.5 h-3.5 ${g.with_email > 0 ? (isDark ? "text-sky-400" : "text-sky-500") : th.dim}`} />
                                <span className={`text-xs font-mono font-bold ${g.with_email > 0 ? (isDark ? "text-sky-400" : "text-sky-600") : th.dim}`}>{g.with_email}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className={`w-3.5 h-3.5 ${th.dim}`} />
                                <span className={`text-xs font-mono font-bold ${th.mono}`}>{g.count}</span>
                              </div>
                              {g.avg_fatturato != null && (
                                <div className="flex items-center gap-1">
                                  <Euro className={`w-3.5 h-3.5 ${isDark ? "text-emerald-400" : "text-emerald-500"}`} />
                                  <span className={`text-[10px] font-mono ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{formatCurrency(g.avg_fatturato)}</span>
                                </div>
                              )}
                              {isSelected && (
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isDark ? "bg-sky-500/20" : "bg-sky-100"}`}>
                                  <CheckCircle className={`w-3.5 h-3.5 ${isDark ? "text-sky-400" : "text-sky-500"}`} />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

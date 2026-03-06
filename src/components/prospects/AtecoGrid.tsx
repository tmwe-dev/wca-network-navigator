import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search, X, Folder, FolderOpen, Check,
  ChevronsUpDown, ChevronRight, ChevronDown, FileText,
} from "lucide-react";
import { useAtecoGroups } from "@/hooks/useProspectStats";
import { ATECO_TREE, type AtecoEntry } from "@/data/atecoCategories";
import { REGIONI_ITALIANE, PROVINCE_ITALIANE } from "@/data/italianProvinces";
import { t } from "@/components/download/theme";
import { getAtecoRank, calcScore, scoreColor, scoreBg, type AtecoRank } from "@/data/atecoRanking";
import type { ProspectFilters } from "@/components/prospects/ProspectAdvancedFilters";

interface AtecoGridProps {
  selected: string[];
  onToggle: (code: string) => void;
  onRemove: (code: string) => void;
  onSelectMultiple?: (codes: string[]) => void;
  isDark: boolean;
  regionFilter: string[];
  onRegionChange: (r: string[]) => void;
  provinceFilter: string[];
  onProvinceChange: (p: string[]) => void;
  rankingFilters?: ProspectFilters;
}

/* ─── Helpers ─── */

const sections = ATECO_TREE.filter(a => a.livello === 1);
const divisions = ATECO_TREE.filter(a => a.livello === 2);
const groups = ATECO_TREE.filter(a => a.livello === 3);

function childDivisions(sectionCode: string) {
  return divisions.filter(d => d.padre === sectionCode);
}
function childGroups(divisionCode: string) {
  return groups.filter(g => g.padre === divisionCode);
}

/** Get all leaf (group-level) codes under a section or division */
function allLeafCodes(entry: AtecoEntry): string[] {
  if (entry.livello === 3) return [entry.codice];
  if (entry.livello === 2) return childGroups(entry.codice).map(g => g.codice);
  // section
  return childDivisions(entry.codice).flatMap(d => childGroups(d.codice).map(g => g.codice));
}

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
}

/* ─── Filter Multi-Select (for region/province) ─── */

function FilterMultiSelect({
  label, placeholder, options, selected, onToggle: onTgl, onClear, isDark,
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
        <PopoverContent className={`w-56 p-0 z-50 ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`} align="start">
          <Command className={isDark ? "bg-slate-900" : ""}>
            <CommandInput placeholder="Cerca..." className={`text-xs ${isDark ? "text-white" : ""}`} />
            <CommandList className="max-h-[300px] overflow-auto">
              <CommandEmpty className={`text-xs ${isDark ? "text-slate-500" : ""}`}>Nessun risultato</CommandEmpty>
              {selected.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={onClear} className={`text-xs ${isDark ? "text-rose-400" : "text-rose-500"}`}>
                    <X className="w-3 h-3 mr-1" /> Deseleziona tutto
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {options.map(opt => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.value} ${opt.label}`}
                    onSelect={() => onTgl(opt.value)}
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
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map(v => (
            <button key={v} onClick={() => onTgl(v)}
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

/* ─── Ranking filter helper ─── */

function passesRankingFilter(rank: AtecoRank | null | undefined, filters: ProspectFilters | undefined): boolean {
  if (!filters) return true;
  const hasRankFilter = filters.rank_volume_min > 0 || filters.rank_valore_min > 0 ||
    filters.rank_intl.length > 0 || filters.rank_score_min > 0;
  if (!hasRankFilter) return true;
  if (!rank) return false;
  if (filters.rank_volume_min > 0 && rank.volume < filters.rank_volume_min) return false;
  if (filters.rank_valore_min > 0 && rank.valore < filters.rank_valore_min) return false;
  if (filters.rank_intl.length > 0 && !filters.rank_intl.includes(rank.intl)) return false;
  if (filters.rank_score_min > 0 && calcScore(rank) < filters.rank_score_min) return false;
  return true;
}

/* ─── Main Component ─── */

export function AtecoGrid({
  selected, onToggle, onRemove, onSelectMultiple, isDark,
  regionFilter, onRegionChange, provinceFilter, onProvinceChange,
  rankingFilters,
}: AtecoGridProps) {
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [onlyInDb, setOnlyInDb] = useState(false);

  const { data: atecoGroups = [] } = useAtecoGroups();

  // Map of ateco code => count from DB
  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of atecoGroups) m.set(g.codice_ateco, g.count);
    return m;
  }, [atecoGroups]);

  // Count for a node (sum of leaf children)
  const nodeCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sections) {
      let sTotal = 0;
      for (const d of childDivisions(s.codice)) {
        let dTotal = 0;
        for (const g of childGroups(d.codice)) {
          const c = countMap.get(g.codice) || 0;
          m.set(g.codice, c);
          dTotal += c;
        }
        m.set(d.codice, dTotal);
        sTotal += dTotal;
      }
      m.set(s.codice, sTotal);
    }
    return m;
  }, [countMap]);

  const toggleExpand = (code: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  // Select/deselect all leaves under a node
  const toggleBranch = (entry: AtecoEntry) => {
    const leaves = allLeafCodes(entry);
    const allSelected = leaves.every(c => selected.includes(c));
    if (allSelected) {
      // deselect all
      for (const c of leaves) if (selected.includes(c)) onRemove(c);
    } else {
      // select all missing
      for (const c of leaves) if (!selected.includes(c)) onToggle(c);
    }
  };

  // Total prospects in DB
  const totalInDb = useMemo(() => {
    let total = 0;
    for (const s of sections) total += nodeCount.get(s.codice) || 0;
    return total;
  }, [nodeCount]);

  // Filter by search + ranking + onlyInDb
  const filteredSections = useMemo(() => {
    const matchesSearch = (entry: AtecoEntry, q: string) =>
      entry.descrizione.toLowerCase().includes(q) || entry.codice.toLowerCase().includes(q);

    // Check if a group passes ranking
    const groupPassesRanking = (code: string) => passesRankingFilter(getAtecoRank(code), rankingFilters);
    // Check if a group has db data
    const groupHasDbData = (code: string) => (nodeCount.get(code) || 0) > 0;
    // Check if a division has any visible group
    const divHasVisibleGroup = (divCode: string) =>
      childGroups(divCode).some(g =>
        groupPassesRanking(g.codice) && (!onlyInDb || groupHasDbData(g.codice))
      );
    // Check if a section has any visible division
    const sectionHasVisibleDiv = (secCode: string) =>
      childDivisions(secCode).some(d => divHasVisibleGroup(d.codice));

    let result = sections;

    // Apply search filter
    if (search && search.length >= 2) {
      const q = search.toLowerCase();
      result = result.filter(s => {
        if (matchesSearch(s, q)) return true;
        return childDivisions(s.codice).some(d =>
          matchesSearch(d, q) ||
          childGroups(d.codice).some(g => matchesSearch(g, q))
        );
      });
    }

    // Apply ranking filter + onlyInDb filter
    result = result.filter(s => sectionHasVisibleDiv(s.codice));

    return result;
  }, [search, rankingFilters, onlyInDb, nodeCount]);

  // Auto-expand sections matching search
  useMemo(() => {
    if (search.length >= 2) {
      const q = search.toLowerCase();
      const toExpand = new Set<string>();
      for (const s of sections) {
        for (const d of childDivisions(s.codice)) {
          if (d.descrizione.toLowerCase().includes(q) || d.codice.toLowerCase().includes(q) ||
            childGroups(d.codice).some(g => g.descrizione.toLowerCase().includes(q) || g.codice.toLowerCase().includes(q))) {
            toExpand.add(s.codice);
            toExpand.add(d.codice);
          }
        }
      }
      if (toExpand.size > 0) setExpanded(toExpand);
    }
  }, [search]);

  const regionOptions = useMemo(() => REGIONI_ITALIANE.map(r => ({ value: r, label: r })), []);
  const provinceOptions = useMemo(() => {
    const filtered = regionFilter.length > 0
      ? PROVINCE_ITALIANE.filter(p => regionFilter.includes(p.regione))
      : PROVINCE_ITALIANE;
    return filtered.map(p => ({ value: p.sigla, label: `${p.sigla} — ${p.nome}`, sub: p.regione }));
  }, [regionFilter]);

  const selectedSet = new Set(selected);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Region & Province filters - always visible */}
      <div className="space-y-2">
        <FilterMultiSelect
          label="Regione"
          placeholder="Tutte le regioni"
          options={regionOptions}
          selected={regionFilter}
          onToggle={v => {
            const next = toggle(regionFilter, v);
            onRegionChange(next);
            if (next.length > 0) {
              const validSigle = new Set(PROVINCE_ITALIANE.filter(p => next.includes(p.regione)).map(p => p.sigla));
              onProvinceChange(provinceFilter.filter(s => validSigle.has(s)));
            }
          }}
          onClear={() => { onRegionChange([]); onProvinceChange([]); }}
          isDark={isDark}
        />
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

      {/* Search ATECO */}
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${th.dim}`} />
        <Input
          placeholder="Cerca ATECO..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`pl-12 h-11 rounded-2xl text-base ${th.input}`}
        />
      </div>

      {/* Only in DB toggle */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
        onlyInDb
          ? isDark ? "bg-sky-500/10 border-sky-500/25" : "bg-sky-50 border-sky-200"
          : isDark ? "bg-white/[0.03] border-white/[0.07]" : "bg-white/60 border-slate-200"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium ${onlyInDb ? (isDark ? "text-sky-300" : "text-sky-700") : (isDark ? "text-slate-400" : "text-slate-500")}`}>
            Solo nel DB
          </span>
          {totalInDb > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isDark ? "bg-white/[0.06] text-slate-400" : "bg-slate-100 text-slate-500"}`}>
              {totalInDb.toLocaleString()}
            </span>
          )}
        </div>
        <Switch
          checked={onlyInDb}
          onCheckedChange={setOnlyInDb}
          className="scale-75 origin-right"
        />
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

      {/* "Seleziona tutti i filtrati" button */}
      {(() => {
        const hasRankFilter = rankingFilters && (rankingFilters.rank_volume_min > 0 || rankingFilters.rank_valore_min > 0 ||
          rankingFilters.rank_intl.length > 0 || rankingFilters.rank_score_min > 0);
        if (!hasRankFilter || !onSelectMultiple) return null;
        const visibleCodes = groups.filter(g => passesRankingFilter(getAtecoRank(g.codice), rankingFilters)).map(g => g.codice);
        const unselectedCount = visibleCodes.filter(c => !selectedSet.has(c)).length;
        return (
          <div className={`flex items-center justify-between px-2 py-1.5 rounded-xl text-xs ${isDark ? "bg-sky-500/10 border border-sky-500/20" : "bg-sky-50 border border-sky-200"}`}>
            <span className={isDark ? "text-sky-300" : "text-sky-700"}>{visibleCodes.length} categorie filtrate</span>
            {unselectedCount > 0 && (
              <button
                onClick={() => onSelectMultiple(visibleCodes)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${isDark ? "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30" : "bg-sky-500 text-white hover:bg-sky-600"}`}
              >
                Seleziona tutti ({visibleCodes.length})
              </button>
            )}
          </div>
        );
      })()}

      {/* ATECO Tree */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-0.5 pr-2">
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className={`w-16 h-16 mx-auto ${isDark ? "text-white/10" : "text-slate-200"}`} />
              <p className={`text-sm ${th.sub}`}>Nessun codice ATECO trovato</p>
            </div>
          ) : (
            filteredSections.map(section => {
              const sCount = nodeCount.get(section.codice) || 0;
              const isOpen = expanded.has(section.codice);
              const sLeaves = allLeafCodes(section);
              const allSel = sLeaves.length > 0 && sLeaves.every(c => selectedSet.has(c));
              const someSel = sLeaves.some(c => selectedSet.has(c));

              // Section-level ranking: average of child divisions
              const sRanks = childDivisions(section.codice).map(d => getAtecoRank(d.codice)).filter(Boolean);
              const sAvgScore = sRanks.length > 0 ? Math.round(sRanks.reduce((s, r) => s + calcScore(r!), 0) / sRanks.length * 10) / 10 : 0;

              const sHighPriority = sAvgScore >= 12;
              const sPriorityClass = sHighPriority
                ? isDark ? "bg-sky-500/[0.06] border-l-2 border-sky-500/40" : "bg-sky-50/80 border-l-2 border-sky-400/50"
                : "";

              return (
                <Collapsible key={section.codice} open={isOpen} onOpenChange={() => toggleExpand(section.codice)}>
                  <div className={`flex items-center gap-1 rounded-xl px-2 py-1.5 transition-all ${sPriorityClass} ${
                    isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
                  }`}>
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {isOpen
                        ? <FolderOpen className={`w-4 h-4 shrink-0 ${isDark ? "text-sky-400" : "text-sky-500"}`} />
                        : <Folder className={`w-4 h-4 shrink-0 ${th.dim}`} />}
                      <span className={`text-xs font-bold uppercase tracking-wide ${th.h2}`}>{section.codice}</span>
                      <span className={`text-[11px] truncate flex-1 ${th.sub}`}>{section.descrizione}</span>
                      {isOpen ? <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${th.dim}`} /> : <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${th.dim}`} />}
                    </CollapsibleTrigger>
                    {sAvgScore > 0 && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${scoreBg(sAvgScore, isDark)} ${scoreColor(sAvgScore, isDark)}`} title={`Score medio: ${sAvgScore}`}>
                        {sAvgScore.toFixed(0)}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); toggleBranch(section); }}
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                        allSel ? "bg-sky-500 border-sky-500" : someSel ? "bg-sky-500/40 border-sky-400" : isDark ? "border-white/15 hover:border-white/30" : "border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {(allSel || someSel) && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <span className={`text-[10px] font-mono w-8 text-right ${th.dim}`}>{sCount || ""}</span>
                  </div>

                  <CollapsibleContent>
                    <div className="ml-4 border-l border-dashed pl-2 space-y-0.5" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)" }}>
                      {childDivisions(section.codice)
                        .filter(div => childGroups(div.codice).some(g => passesRankingFilter(getAtecoRank(g.codice), rankingFilters) && (!onlyInDb || (nodeCount.get(g.codice) || 0) > 0)))
                        .map(div => {
                        const dCount = nodeCount.get(div.codice) || 0;
                        const isDivOpen = expanded.has(div.codice);
                        const dLeaves = allLeafCodes(div);
                        const allDSel = dLeaves.length > 0 && dLeaves.every(c => selectedSet.has(c));
                        const someDSel = dLeaves.some(c => selectedSet.has(c));
                        const dRank = getAtecoRank(div.codice);
                        const dScore = dRank ? calcScore(dRank) : 0;
                        const dHighPriority = dScore >= 12;
                        const dPriorityClass = dHighPriority
                          ? isDark ? "bg-sky-500/[0.06] border-l-2 border-sky-500/40" : "bg-sky-50/80 border-l-2 border-sky-400/50"
                          : "";

                        return (
                          <Collapsible key={div.codice} open={isDivOpen} onOpenChange={() => toggleExpand(div.codice)}>
                            <div className={`flex items-center gap-1 rounded-lg px-2 py-1 transition-all ${dPriorityClass} ${
                              isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
                            }`}>
                              <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                {isDivOpen
                                  ? <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-sky-400/70" : "text-sky-400"}`} />
                                  : <Folder className={`w-3.5 h-3.5 shrink-0 ${th.dim}`} />}
                                <span className={`text-xs font-semibold ${th.h2}`}>{div.codice}</span>
                                <span className={`text-[11px] truncate flex-1 ${th.sub}`}>{div.descrizione}</span>
                                {isDivOpen ? <ChevronDown className={`w-3 h-3 shrink-0 ${th.dim}`} /> : <ChevronRight className={`w-3 h-3 shrink-0 ${th.dim}`} />}
                              </CollapsibleTrigger>
                              {dScore > 0 && (
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${scoreBg(dScore, isDark)} ${scoreColor(dScore, isDark)}`} title={dRank ? `Vol:${dRank.volume} Val:${dRank.valore} ${dRank.intl} — ${dRank.note}` : ""}>
                                  {dScore.toFixed(0)}
                                </span>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); toggleBranch(div); }}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  allDSel ? "bg-sky-500 border-sky-500" : someDSel ? "bg-sky-500/40 border-sky-400" : isDark ? "border-white/15 hover:border-white/30" : "border-slate-300 hover:border-slate-400"
                                }`}
                              >
                                {(allDSel || someDSel) && <Check className="w-2.5 h-2.5 text-white" />}
                              </button>
                              <span className={`text-[10px] font-mono w-7 text-right ${th.dim}`}>{dCount || ""}</span>
                            </div>

                            <CollapsibleContent>
                              <div className="ml-5 space-y-0.5">
                                {childGroups(div.codice).filter(g => passesRankingFilter(getAtecoRank(g.codice), rankingFilters) && (!onlyInDb || (nodeCount.get(g.codice) || 0) > 0)).map(grp => {
                                  const gCount = nodeCount.get(grp.codice) || 0;
                                  const isSel = selectedSet.has(grp.codice);
                                  const gRank = getAtecoRank(grp.codice);
                                  const gScore = gRank ? calcScore(gRank) : 0;
                                  const gHighPriority = gScore >= 12;
                                  const gPriorityClass = gHighPriority && !isSel
                                    ? isDark ? "bg-sky-500/[0.06] border-l-2 border-sky-500/40" : "bg-sky-50/80 border-l-2 border-sky-400/50"
                                    : "";

                                  return (
                                    <button
                                      key={grp.codice}
                                      onClick={() => onToggle(grp.codice)}
                                      className={`w-full flex items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-all ${gPriorityClass} ${
                                        isSel
                                          ? isDark ? "bg-sky-500/10 border border-sky-500/20" : "bg-sky-50 border border-sky-200"
                                          : isDark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50"
                                      }`}
                                      title={gRank ? `Vol:${"★".repeat(gRank.volume)}  Val:${"★".repeat(gRank.valore)}  ${gRank.intl}\n${gRank.note}` : ""}
                                    >
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                        isSel ? "bg-sky-500 border-sky-500" : isDark ? "border-white/15" : "border-slate-300"
                                      }`}>
                                        {isSel && <Check className="w-2.5 h-2.5 text-white" />}
                                      </div>
                                      <span className={`text-[11px] font-medium ${th.h2}`}>{grp.codice}</span>
                                      <span className={`text-[11px] truncate flex-1 ${th.sub}`}>{grp.descrizione}</span>
                                      {gScore > 0 && (
                                        <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded border shrink-0 ${scoreBg(gScore, isDark)} ${scoreColor(gScore, isDark)}`}>
                                          {gScore.toFixed(0)}
                                        </span>
                                      )}
                                      {gCount > 0 && (
                                        <span className={`text-[10px] font-mono ${isDark ? "text-sky-400/70" : "text-sky-500"}`}>{gCount}</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

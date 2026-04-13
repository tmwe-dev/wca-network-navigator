import { useState, useMemo } from "react";
import { useAtecoGroups } from "@/hooks/useProspectStats";
import { ATECO_TREE, type AtecoEntry } from "@/data/atecoCategories";
import { REGIONI_ITALIANE, PROVINCE_ITALIANE } from "@/data/italianProvinces";
import { getAtecoRank, calcScore, type AtecoRank } from "@/data/atecoRanking";
import type { ProspectFilters } from "@/components/prospects/ProspectAdvancedFilters";

export const sections = ATECO_TREE.filter(a => a.livello === 1);
export const divisions = ATECO_TREE.filter(a => a.livello === 2);
export const groups = ATECO_TREE.filter(a => a.livello === 3);

export function childDivisions(sectionCode: string) {
  return divisions.filter(d => d.padre === sectionCode);
}
export function childGroups(divisionCode: string) {
  return groups.filter(g => g.padre === divisionCode);
}

export function allLeafCodes(entry: AtecoEntry): string[] {
  if (entry.livello === 3) return [entry.codice];
  if (entry.livello === 2) return childGroups(entry.codice).map(g => g.codice);
  return childDivisions(entry.codice).flatMap(d => childGroups(d.codice).map(g => g.codice));
}

export function toggleInList(list: string[], item: string) {
  return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
}

export function passesRankingFilter(rank: AtecoRank | null | undefined, filters: ProspectFilters | undefined): boolean {
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

interface UseAtecoGridOpts {
  selected: string[];
  onToggle: (code: string) => void;
  onRemove: (code: string) => void;
  regionFilter: string[];
  onRegionChange: (r: string[]) => void;
  provinceFilter: string[];
  onProvinceChange: (p: string[]) => void;
  rankingFilters?: ProspectFilters;
}

export function useAtecoGrid(opts: UseAtecoGridOpts) {
  const { selected, onToggle, onRemove, regionFilter, onRegionChange, provinceFilter, onProvinceChange, rankingFilters } = opts;
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [onlyInDb, setOnlyInDb] = useState(false);

  const { data: atecoGroups = [] } = useAtecoGroups();

  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of atecoGroups) m.set(g.codice_ateco, g.count);
    return m;
  }, [atecoGroups]);

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

  const toggleBranch = (entry: AtecoEntry) => {
    const leaves = allLeafCodes(entry);
    const allSelected = leaves.every(c => selected.includes(c));
    if (allSelected) {
      for (const c of leaves) if (selected.includes(c)) onRemove(c);
    } else {
      for (const c of leaves) if (!selected.includes(c)) onToggle(c);
    }
  };

  const totalInDb = useMemo(() => {
    let total = 0;
    for (const s of sections) total += nodeCount.get(s.codice) || 0;
    return total;
  }, [nodeCount]);

  const filteredSections = useMemo(() => {
    const matchesSearch = (entry: AtecoEntry, q: string) =>
      entry.descrizione.toLowerCase().includes(q) || entry.codice.toLowerCase().includes(q);
    const groupPassesRanking = (code: string) => passesRankingFilter(getAtecoRank(code), rankingFilters);
    const groupHasDbData = (code: string) => (nodeCount.get(code) || 0) > 0;
    const divHasVisibleGroup = (divCode: string) =>
      childGroups(divCode).some(g => groupPassesRanking(g.codice) && (!onlyInDb || groupHasDbData(g.codice)));
    const sectionHasVisibleDiv = (secCode: string) =>
      childDivisions(secCode).some(d => divHasVisibleGroup(d.codice));

    let result = sections;
    if (search && search.length >= 2) {
      const q = search.toLowerCase();
      result = result.filter(s => {
        if (matchesSearch(s, q)) return true;
        return childDivisions(s.codice).some(d =>
          matchesSearch(d, q) || childGroups(d.codice).some(g => matchesSearch(g, q))
        );
      });
    }
    result = result.filter(s => sectionHasVisibleDiv(s.codice));
    return result;
  }, [search, rankingFilters, onlyInDb, nodeCount]);

  // Auto-expand on search
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

  const handleRegionToggle = (v: string) => {
    const next = toggleInList(regionFilter, v);
    onRegionChange(next);
    if (next.length > 0) {
      const validSigle = new Set(PROVINCE_ITALIANE.filter(p => next.includes(p.regione)).map(p => p.sigla));
      onProvinceChange(provinceFilter.filter(s => validSigle.has(s)));
    }
  };

  const handleRegionClear = () => { onRegionChange([]); onProvinceChange([]); };
  const handleProvinceToggle = (v: string) => onProvinceChange(toggleInList(provinceFilter, v));
  const handleProvinceClear = () => onProvinceChange([]);

  const selectedSet = new Set(selected);

  return {
    search, setSearch,
    expanded, toggleExpand,
    onlyInDb, setOnlyInDb,
    nodeCount, totalInDb,
    filteredSections,
    toggleBranch,
    regionOptions, provinceOptions,
    handleRegionToggle, handleRegionClear,
    handleProvinceToggle, handleProvinceClear,
    selectedSet,
    rankingFilters,
  };
}

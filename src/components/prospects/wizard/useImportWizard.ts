import { useState } from "react";
import { ATECO_TREE } from "@/data/atecoCategories";
import { PROVINCE_ITALIANE } from "@/data/italianProvinces";
import type { ProspectFilters } from "../ProspectAdvancedFilters";
import { EMPTY_FILTERS } from "../ProspectAdvancedFilters";

export interface WizardState {
  atecoCodes: string[];
  regions: string[];
  provinces: string[];
  filters: ProspectFilters;
}

const ATECO_GROUPS = ATECO_TREE.filter(e => e.livello === 2);

export const FATTURATO_PRESETS = [
  { label: "Micro", desc: "< 500K", min: "", max: "500" },
  { label: "Piccola", desc: "500K – 5M", min: "500", max: "5000" },
  { label: "Media", desc: "5M – 50M", min: "5000", max: "50000" },
  { label: "Grande", desc: "> 50M", min: "50000", max: "" },
];

export const DIPENDENTI_PRESETS = [
  { label: "Micro", desc: "< 10", min: "", max: "10" },
  { label: "Piccola", desc: "10 – 50", min: "10", max: "50" },
  { label: "Media", desc: "50 – 250", min: "50", max: "250" },
  { label: "Grande", desc: "> 250", min: "250", max: "" },
];

interface UseImportWizardProps {
  initialAtecoCodes?: string[];
  initialRegions?: string[];
  initialProvinces?: string[];
  onStart: (state: WizardState) => void;
}

export function useImportWizard({
  initialAtecoCodes = [],
  initialRegions = [],
  initialProvinces = [],
  onStart,
}: UseImportWizardProps) {
  const [step, setStep] = useState(1);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [atecoCodes, setAtecoCodes] = useState<string[]>(initialAtecoCodes);
  const [regions, setRegions] = useState<string[]>(initialRegions);
  const [provinces, setProvinces] = useState<string[]>(initialProvinces);
  const [filters, setFilters] = useState<ProspectFilters>({ ...EMPTY_FILTERS });
  const [fatturatoPreset, setFatturatoPreset] = useState<number | null>(null);
  const [dipendentiPreset, setDipendentiPreset] = useState<number | null>(null);

  const toggleCode = (code: string) => {
    setAtecoCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const toggleSection = (sectionCode: string) => {
    const groups = ATECO_GROUPS.filter(g => g.padre === sectionCode);
    const groupCodes = groups.map(g => g.codice);
    const allSelected = groupCodes.every(c => atecoCodes.includes(c));
    if (allSelected) {
      setAtecoCodes(prev => prev.filter(c => !groupCodes.includes(c)));
    } else {
      setAtecoCodes(prev => [...new Set([...prev, ...groupCodes])]);
    }
  };

  const toggleRegion = (region: string) => {
    if (region === "__ALL__") {
      setRegions([]);
      setProvinces([]);
      return;
    }
    setRegions(prev => {
      if (prev.includes(region)) {
        const provs = PROVINCE_ITALIANE.filter(p => p.regione === region).map(p => p.sigla);
        setProvinces(pp => pp.filter(p => !provs.includes(p)));
        return prev.filter(r => r !== region);
      }
      return [...prev, region];
    });
  };

  const toggleProvince = (sigla: string) => {
    setProvinces(prev => prev.includes(sigla) ? prev.filter(p => p !== sigla) : [...prev, sigla]);
  };

  const applyFatturatoPreset = (idx: number) => {
    const p = FATTURATO_PRESETS[idx];
    if (fatturatoPreset === idx) {
      setFatturatoPreset(null);
      setFilters(f => ({ ...f, fatturato_min: "", fatturato_max: "" }));
    } else {
      setFatturatoPreset(idx);
      setFilters(f => ({ ...f, fatturato_min: p.min, fatturato_max: p.max }));
    }
  };

  const applyDipendentiPreset = (idx: number) => {
    const p = DIPENDENTI_PRESETS[idx];
    if (dipendentiPreset === idx) {
      setDipendentiPreset(null);
      setFilters(f => ({ ...f, dipendenti_min: "", dipendenti_max: "" }));
    } else {
      setDipendentiPreset(idx);
      setFilters(f => ({ ...f, dipendenti_min: p.min, dipendenti_max: p.max }));
    }
  };

  const resetFiltersAndSkip = () => {
    setFilters({ ...EMPTY_FILTERS });
    setFatturatoPreset(null);
    setDipendentiPreset(null);
    setStep(4);
  };

  const handleStart = () => onStart({ atecoCodes, regions, provinces, filters });

  const hasFilters = fatturatoPreset !== null || dipendentiPreset !== null ||
    filters.has_phone || filters.has_email || filters.has_phone_and_email;

  return {
    step, setStep,
    expandedSection, setExpandedSection,
    atecoCodes, regions, provinces, filters, setFilters,
    fatturatoPreset, dipendentiPreset,
    toggleCode, toggleSection, toggleRegion, toggleProvince,
    applyFatturatoPreset, applyDipendentiPreset,
    resetFiltersAndSkip, handleStart, hasFilters,
  };
}

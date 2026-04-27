/**
 * useFilterAndSort — Filtering and sorting logic for senders and groups.
 */
import { useMemo, useState } from "react";
import type { EmailSenderGroup, SenderAnalysis, SortOption } from "@/types/email-management";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

const VOLUME_FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "2", label: ">2 email" },
  { value: "5", label: ">5 email" },
  { value: "10", label: ">10 email" },
  { value: "50", label: ">50 email" },
];

export function useFilterAndSort(senders: SenderAnalysis[], groups: EmailSenderGroup[]) {
  const g = useGlobalFilters();
  const searchQuery = g.filters.emailIntelSearch;
  const setSearchQuery = (v: string) => g.setFilter("emailIntelSearch", v);
  const sortOption = g.filters.emailIntelSort as SortOption;
  const setSortOption = (v: SortOption) => g.setFilter("emailIntelSort", v);
  const volumeFilter = g.filters.emailIntelVolume;
  const setVolumeFilter = (v: string) => g.setFilter("emailIntelVolume", v);
  const hideClassified = g.filters.emailIntelHideClassified;
  const setHideClassified = (v: boolean) => g.setFilter("emailIntelHideClassified", v);
  const [groupSortOption, setGroupSortOption] = useState<"alpha" | "count">("alpha");
  const [activeLetterFilter, setActiveLetterFilter] = useState<string | null>(null);

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

  // Filter senders by volume and search
  const filteredSenders = useMemo(() => {
    const minVolume = volumeFilter === "all" ? 0 : parseInt(volumeFilter);
    return senders.filter((s) => {
      if (hideClassified && s.isClassified) return false;
      if (s.emailCount < minVolume) return false;
      if (!searchQuery) return true;
      return (
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.companyName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [senders, volumeFilter, searchQuery, hideClassified]);

  // Sort senders
  const sortedSenders = useMemo(() => {
    const sorted = [...filteredSenders];
    switch (sortOption) {
      case "name-asc":
        return sorted.sort((a, b) => a.companyName.localeCompare(b.companyName));
      case "name-desc":
        return sorted.sort((a, b) => b.companyName.localeCompare(a.companyName));
      case "count-asc":
        return sorted.sort((a, b) => a.emailCount - b.emailCount);
      case "count-desc":
        return sorted.sort((a, b) => b.emailCount - a.emailCount);
      case "ai_group":
        // Alfabetico per gruppo suggerito dall'AI; sender senza suggerimento in fondo.
        return sorted.sort((a, b) => {
          const ag = a.aiSuggestion?.group_name ?? "";
          const bg = b.aiSuggestion?.group_name ?? "";
          if (!ag && !bg) return 0;
          if (!ag) return 1;
          if (!bg) return -1;
          return ag.localeCompare(bg);
        });
      default:
        return sorted;
    }
  }, [filteredSenders, sortOption]);

  // Letters that have at least one group
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    groups.forEach((g) => {
      const first = g.nome_gruppo.charAt(0).toUpperCase();
      if (/[A-Z]/.test(first)) letters.add(first);
      else letters.add("#");
    });
    return letters;
  }, [groups]);

  // Sort and filter groups
  const sortedGroups = useMemo(() => {
    let filtered = [...groups];

    // Apply letter filter
    if (activeLetterFilter) {
      if (activeLetterFilter === "#") {
        filtered = filtered.filter((g) => !/^[A-Z]/i.test(g.nome_gruppo));
      } else {
        filtered = filtered.filter((g) => g.nome_gruppo.charAt(0).toUpperCase() === activeLetterFilter);
      }
    }

    if (groupSortOption === "alpha") {
      return filtered.sort((a, b) => a.nome_gruppo.localeCompare(b.nome_gruppo));
    } else {
      return filtered.sort((a, b) => {
        const countA = (a as any).assigned_count || 0;
        const countB = (b as any).assigned_count || 0;
        return countB - countA;
      });
    }
  }, [groups, groupSortOption, activeLetterFilter]);

  const totalEmailCount = useMemo(
    () => senders.reduce((sum, s) => sum + s.emailCount, 0),
    [senders]
  );

  return {
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    volumeFilter,
    setVolumeFilter,
    hideClassified,
    setHideClassified,
    groupSortOption,
    setGroupSortOption,
    activeLetterFilter,
    setActiveLetterFilter,
    filteredSenders,
    sortedSenders,
    sortedGroups,
    availableLetters,
    ALPHABET,
    VOLUME_FILTERS,
    totalEmailCount,
  };
}

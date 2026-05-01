/**
 * useActiveFilterChips — derives a list of removable chips from the global
 * filter state for a given entity context (CRM, partners, biglietti).
 *
 * The chips reflect what the user has selected inside the left FiltersDrawer
 * (the SSOT). Removing a chip resets the corresponding slice of state.
 *
 * No business logic here — pure presentation derivation.
 */
import { useMemo } from "react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { countryFlag } from "@/components/contacts/contactHelpers";
import { Plane, Search as SearchIcon, ShieldCheck, Filter, Tag, Layers, Mail, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

export type ChipTone = "neutral" | "primary" | "circuit-out" | "circuit-in" | "danger";

export interface FilterChip {
  readonly key: string;
  readonly label: string;
  readonly tone: ChipTone;
  readonly icon?: ComponentType<{ className?: string }>;
  readonly onRemove?: () => void;
}

export type ChipContext = "crm" | "partners" | "biglietti";

const MAX_COUNTRY_CHIPS = 3;

export function useActiveFilterChips(context: ChipContext): readonly FilterChip[] {
  const g = useGlobalFilters();
  const f = g.filters;

  return useMemo<readonly FilterChip[]>(() => {
    const chips: FilterChip[] = [];

    // ---------- Circuito (holding pattern) ----------
    if (context === "crm") {
      if (f.holdingPattern === "out") {
        chips.push({
          key: "holdingPattern",
          label: "Fuori circuito",
          tone: "circuit-out",
          icon: Plane,
          onRemove: () => g.setHoldingPattern("all"),
        });
      } else if (f.holdingPattern === "in") {
        chips.push({
          key: "holdingPattern",
          label: "In circuito",
          tone: "circuit-in",
          icon: Plane,
          onRemove: () => g.setHoldingPattern("all"),
        });
      }
    }

    // ---------- Search ----------
    if (f.search?.trim()) {
      chips.push({
        key: "search",
        label: `"${f.search.trim()}"`,
        tone: "primary",
        icon: SearchIcon,
        onRemove: () => g.setSearch(""),
      });
    }

    // ---------- Match WCA (CRM) ----------
    if (context === "crm" && f.crmWcaMatch && f.crmWcaMatch !== "all") {
      chips.push({
        key: "crmWcaMatch",
        label: f.crmWcaMatch === "matched" ? "WCA ✓" : "Solo CRM",
        tone: "primary",
        icon: ShieldCheck,
        onRemove: () => g.setCrmWcaMatch("all"),
      });
    }

    // ---------- Countries ----------
    const countries = context === "crm"
      ? Array.from(f.crmSelectedCountries)
      : context === "partners"
        ? Array.from(f.networkSelectedCountries)
        : [];
    if (countries.length > 0) {
      countries.slice(0, MAX_COUNTRY_CHIPS).forEach((cc) => {
        chips.push({
          key: `country:${cc}`,
          label: `${countryFlag(cc)} ${cc}`,
          tone: "primary",
          onRemove: () => {
            const next = new Set(countries);
            next.delete(cc);
            if (context === "crm") g.setCrmSelectedCountries(next as never);
            else g.setNetworkSelectedCountries(next as never);
          },
        });
      });
      if (countries.length > MAX_COUNTRY_CHIPS) {
        const extra = countries.length - MAX_COUNTRY_CHIPS;
        chips.push({
          key: "country:more",
          label: `+${extra} paesi`,
          tone: "neutral",
          onRemove: () => {
            if (context === "crm") g.setCrmSelectedCountries(new Set() as never);
            else g.setNetworkSelectedCountries(new Set() as never);
          },
        });
      }
    }

    // ---------- Lead status ----------
    if (context === "crm" && f.leadStatus && f.leadStatus !== "all") {
      chips.push({
        key: "leadStatus",
        label: `Stato: ${f.leadStatus}`,
        tone: "primary",
        icon: Tag,
        onRemove: () => g.setLeadStatus("all"),
      });
    }

    // ---------- Origin ----------
    if (context === "crm") {
      const origins = Array.from(f.crmOrigin);
      if (origins.length > 0) {
        chips.push({
          key: "crmOrigin",
          label: `Origine: ${origins.length === 1 ? origins[0] : `${origins.length}`}`,
          tone: "primary",
          icon: Filter,
          onRemove: () => g.setCrmOrigin(new Set() as never),
        });
      }
    }

    // ---------- Quality (CRM) ----------
    if (context === "crm" && f.crmQuality && f.crmQuality !== "all") {
      chips.push({
        key: "crmQuality",
        label: `Qualità: ${f.crmQuality}`,
        tone: "primary",
        icon: Sparkles,
        onRemove: () => g.setCrmQuality("all"),
      });
    }

    // ---------- Channel (CRM) ----------
    if (context === "crm" && f.crmChannel && f.crmChannel !== "all") {
      chips.push({
        key: "crmChannel",
        label: `Canale: ${f.crmChannel}`,
        tone: "primary",
        icon: Mail,
        onRemove: () => g.setCrmChannel("all"),
      });
    }

    // ---------- Group by (CRM) ----------
    if (context === "crm" && f.groupBy && f.groupBy !== "country") {
      const labelMap: Record<string, string> = {
        origin: "Origine", status: "Stato", date: "Data",
      };
      chips.push({
        key: "groupBy",
        label: `Raggruppa: ${labelMap[f.groupBy] ?? f.groupBy}`,
        tone: "neutral",
        icon: Layers,
        onRemove: () => g.setGroupBy("country"),
      });
    }

    // ---------- CRM group tab (a country selected from the deprecated horizontal tabs) ----------
    if (context === "crm" && f.crmGroupTab) {
      const lbl = f.groupBy === "country" ? `${countryFlag(f.crmGroupTab)} ${f.crmGroupTab}` : f.crmGroupTab;
      chips.push({
        key: "crmGroupTab",
        label: lbl,
        tone: "primary",
        onRemove: () => g.setCrmGroupTab(""),
      });
    }

    return chips;
  }, [context, f, g]);
}

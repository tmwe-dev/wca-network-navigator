import { Zap, Globe } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";

const ARENA_FOCUS = [
  { value: "all", label: "Tutti" },
  { value: "new_contacts", label: "Nuovi contatti" },
  { value: "follow_up", label: "Follow-up" },
  { value: "re_engage", label: "Re-engage" },
];

const ARENA_CHANNEL = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
];

export function ArenaFiltersSection() {
  const g = useGlobalFilters();
  return (
    <>
      <FilterSection icon={Zap} label="Focus">
        <ChipGroup>{ARENA_FOCUS.map(o => <Chip key={o.value} active={g.filters.search === o.value} onClick={() => g.setSearch(o.value)}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
      <FilterSection icon={Globe} label="Canale">
        <ChipGroup>{ARENA_CHANNEL.map(o => <Chip key={o.value} active={g.filters.inreachChannel === o.value} onClick={() => g.setInreachChannel(o.value as "email" | "whatsapp" | "linkedin")}>{o.label}</Chip>)}</ChipGroup>
      </FilterSection>
    </>
  );
}

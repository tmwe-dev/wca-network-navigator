import { Search, ArrowUpDown, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { EMAIL_CATEGORIES, EMAIL_SORT } from "./constants";

interface InboxFiltersSectionProps {
  channel: "email" | "whatsapp" | "linkedin";
  channelIcon: unknown;
}

export function InboxFiltersSection({ channel, channelIcon: ChannelIcon }: InboxFiltersSectionProps) {
  const g = useGlobalFilters();
  const isEmail = channel === "email";
  const channelLabel = isEmail ? "Email" : channel === "whatsapp" ? "WhatsApp" : "LinkedIn";

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.sortingSearch} onChange={e => g.setSortingSearch(e.target.value)} placeholder={`Cerca in ${channelLabel}...`} className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>
      <FilterSection icon={ChannelIcon} label="Stato">
        <ChipGroup>
          <Chip active={g.filters.sortingFilter === "all"} onClick={() => g.setSortingFilter("all")}>Tutti</Chip>
          <Chip active={g.filters.sortingFilter === "unreviewed"} onClick={() => g.setSortingFilter("unreviewed")}>Non letti</Chip>
          <Chip active={g.filters.sortingFilter === "reviewed"} onClick={() => g.setSortingFilter("reviewed")}>Letti</Chip>
        </ChipGroup>
      </FilterSection>
      {isEmail && (
        <FilterSection icon={Tag} label="Categoria">
          <ChipGroup>
            {EMAIL_CATEGORIES.map(o => <Chip key={o.value} active={g.filters.emailCategory === o.value} onClick={() => g.setEmailCategory(o.value)}>{o.label}</Chip>)}
          </ChipGroup>
        </FilterSection>
      )}
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {isEmail ? (
            EMAIL_SORT.map(o => <Chip key={o.value} active={g.filters.emailSort === o.value} onClick={() => g.setEmailSort(o.value)}>{o.label}</Chip>)
          ) : (
            <>
              <Chip active={g.filters.sortBy === "date_desc"} onClick={() => g.setSortBy("date_desc")}>Più recenti</Chip>
              <Chip active={g.filters.sortBy === "date_asc"} onClick={() => g.setSortBy("date_asc")}>Più vecchi</Chip>
              <Chip active={g.filters.sortBy === "unread"} onClick={() => g.setSortBy("unread")}>Non letti prima</Chip>
            </>
          )}
        </ChipGroup>
      </FilterSection>
    </>
  );
}

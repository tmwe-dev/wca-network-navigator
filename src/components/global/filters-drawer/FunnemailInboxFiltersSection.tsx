/**
 * FunnemailInboxFiltersSection — filtri sidebar della Inbox Funnemail.
 *
 * Espone: ricerca testo, vista (tutte/non lette/urgenti/agenda/commerciali),
 * cartelle dinamiche caricate da DB (operative + archive + sorting).
 *
 * Tutta la logica vive in `useGlobalFilters` + DAL `funnemailInbox`.
 */
import { Search, Eye, Folder } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { queryKeys } from "@/lib/queryKeys";
import { listFunnemailFolders, countFunnemailByFolder, type FunnemailFolder } from "@/data/funnemailInbox";

const VIEW_OPTIONS: Array<{ value: "all" | "unread" | "urgent" | "agenda" | "commercial"; label: string }> = [
  { value: "all", label: "Tutte" },
  { value: "unread", label: "Non lette" },
  { value: "urgent", label: "Urgenti" },
  { value: "agenda", label: "In agenda" },
  { value: "commercial", label: "Commerciali" },
];

const SECTION_LABEL: Record<string, string> = {
  operative: "Operative",
  archive: "Archivio",
  sorting: "Da smistare",
};

export function FunnemailInboxFiltersSection() {
  const g = useGlobalFilters();

  const foldersQ = useQuery({
    queryKey: queryKeys.funnemailInbox.folders,
    queryFn: listFunnemailFolders,
    staleTime: 5 * 60_000,
  });

  const countsQ = useQuery({
    queryKey: queryKeys.funnemailInbox.counts,
    queryFn: countFunnemailByFolder,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const folders: FunnemailFolder[] = foldersQ.data ?? [];
  const counts = countsQ.data ?? {};

  const grouped = folders.reduce<Record<string, FunnemailFolder[]>>((acc, f) => {
    (acc[f.section] ??= []).push(f);
    return acc;
  }, {});

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input
          value={g.filters.funnemailSearch}
          onChange={(e) => g.setFilter("funnemailSearch", e.target.value)}
          placeholder="Oggetto o mittente..."
          className="h-8 text-xs bg-muted/30 border-border/40"
        />
      </FilterSection>

      <FilterSection icon={Eye} label="Vista">
        <ChipGroup>
          {VIEW_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={g.filters.funnemailView === o.value}
              onClick={() => g.setFilter("funnemailView", o.value)}
            >
              {o.label}
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {(["operative", "archive", "sorting"] as const).map((section) => {
        const items = grouped[section];
        if (!items || items.length === 0) return null;
        return (
          <FilterSection key={section} icon={Folder} label={SECTION_LABEL[section]}>
            <ChipGroup>
              {items.map((f) => {
                const c = counts[f.slug] ?? 0;
                const active = g.filters.funnemailFolder === f.slug;
                return (
                  <Chip
                    key={f.slug}
                    active={active}
                    onClick={() => g.setFilter("funnemailFolder", f.slug)}
                  >
                    <span>{f.icon ?? "📂"}</span>
                    <span>{f.label}</span>
                    {c > 0 && <span className="opacity-60 ml-0.5">({c})</span>}
                  </Chip>
                );
              })}
            </ChipGroup>
          </FilterSection>
        );
      })}
    </>
  );
}
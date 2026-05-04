import { Archive, Folder, HelpCircle, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FunnemailGroupFolder } from "@/data/funnemailInbox";

interface Props {
  folders: FunnemailGroupFolder[];
  counts: Record<string, number>;
  selectedFolder: string;
  totalCount: number;
  loading: boolean;
  onSelect: (slug: string) => void;
}

const SECTION_META = {
  priority: { label: "Prioritarie", icon: Star },
  secondary: { label: "Secondarie", icon: Archive },
  unclassified: { label: "Da classificare", icon: HelpCircle },
} as const;

export function InboxGroupsSidebar({ folders, counts, selectedFolder, totalCount, loading, onSelect }: Props) {
  const grouped = folders.reduce<Record<FunnemailGroupFolder["section"], FunnemailGroupFolder[]>>(
    (acc, folder) => {
      acc[folder.section].push(folder);
      return acc;
    },
    { priority: [], secondary: [], unclassified: [] },
  );

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-background/95">
      <div className="border-b border-border px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Funny Mail</p>
        <button
          type="button"
          onClick={() => onSelect("all")}
          className={cn(
            "mt-2 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors",
            selectedFolder === "all" ? "bg-primary/15 text-primary" : "hover:bg-muted/50",
          )}
        >
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <Folder className="h-4 w-4 shrink-0" />
            <span className="truncate">Tutte le inbox</span>
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{totalCount}</span>
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {(["priority", "secondary", "unclassified"] as const).map((section) => {
            const items = grouped[section];
            const MetaIcon = SECTION_META[section].icon;
            if (!loading && items.length === 0) return null;
            return (
              <div key={section} className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <MetaIcon className="h-3 w-3" />
                  {SECTION_META[section].label}
                </div>
                {items.map((folder) => {
                  const active = selectedFolder === folder.slug;
                  const count = counts[folder.slug] ?? 0;
                  return (
                    <button
                      key={folder.slug}
                      type="button"
                      onClick={() => onSelect(folder.slug)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                        active ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted/50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <span className="shrink-0">{folder.icon ?? "📁"}</span>
                        <span className="truncate">{folder.label}</span>
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", active ? "bg-primary/20" : "bg-muted text-muted-foreground")}>{count}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
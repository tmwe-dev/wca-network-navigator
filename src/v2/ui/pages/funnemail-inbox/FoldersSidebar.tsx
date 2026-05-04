/**
 * FoldersSidebar — sidebar a cartelle del client Funnemail.
 *
 * Tre sezioni: Operative (in alto), Archivio (collassabile), Smistamento.
 * Ogni cartella mostra icona, label e contatore (ultimi 30gg).
 */
import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FunnemailFolder } from "@/data/funnemailInbox";

interface Props {
  folders: FunnemailFolder[];
  counts: Record<string, number>;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  loading: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  operative: "Operative",
  archive: "Archivio",
  sorting: "Da smistare",
};

export function FoldersSidebar({ folders, counts, selectedSlug, onSelect, loading }: Props): React.ReactElement {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    operative: true,
    archive: false,
    sorting: true,
  });

  const grouped = React.useMemo(() => {
    const out: Record<string, FunnemailFolder[]> = { operative: [], archive: [], sorting: [] };
    for (const f of folders) {
      if (out[f.section]) out[f.section].push(f);
    }
    return out;
  }, [folders]);

  return (
    <aside className="w-56 shrink-0 border-r border-border/40 bg-muted/10 flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/40 flex-shrink-0">
        <h2 className="text-sm font-semibold">Funnemail</h2>
        <p className="text-[11px] text-muted-foreground">Smistamento via prompt</p>
      </div>
      <ScrollArea className="flex-1">
        {loading && <div className="px-3 py-4 text-xs text-muted-foreground">Caricamento…</div>}
        {!loading && (["operative", "archive", "sorting"] as const).map((section) => {
          const items = grouped[section];
          if (!items || items.length === 0) return null;
          const open = openSections[section];
          return (
            <div key={section} className="py-1">
              <button
                type="button"
                onClick={() => setOpenSections((s) => ({ ...s, [section]: !s[section] }))}
                className="w-full px-3 py-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>{SECTION_LABELS[section]}</span>
              </button>
              {open && (
                <ul className="space-y-0.5 px-1">
                  {items.map((f) => {
                    const count = counts[f.slug] ?? 0;
                    const active = f.slug === selectedSlug;
                    return (
                      <li key={f.slug}>
                        <button
                          type="button"
                          onClick={() => onSelect(f.slug)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors",
                            active ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted/50",
                          )}
                        >
                          <span className="text-base leading-none">{f.icon ?? "📂"}</span>
                          <span className="flex-1 truncate">{f.label}</span>
                          {count > 0 && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums",
                              active ? "bg-primary/20" : "bg-muted text-muted-foreground",
                            )}>{count}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </ScrollArea>
    </aside>
  );
}
/**
 * InboxGroupsSidebar — sidebar cartelle Funnemail.
 *
 * Sezioni: Prioritarie / Secondarie / Da classificare.
 * Drag&drop libero fra Prioritarie e Secondarie (puntini a sinistra).
 * Ordine personalizzato persistito in localStorage per-utente.
 */
import { useEffect, useMemo, useState } from "react";
import { Archive, GripVertical, HelpCircle, Star, Inbox, Mail } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FunnemailGroupFolder } from "@/data/funnemailInbox";

type Section = FunnemailGroupFolder["section"];

interface Props {
  folders: FunnemailGroupFolder[];
  counts: Record<string, number>;
  selectedFolder: string;
  totalCount: number;
  loading: boolean;
  onSelect: (slug: string) => void;
  variant?: "standalone" | "drawer";
}

const SECTION_META: Record<Section, { label: string; icon: typeof Star }> = {
  operative: { label: "Operative", icon: Inbox },
  archive: { label: "Archivio", icon: Archive },
  sorting: { label: "Da smistare", icon: HelpCircle },
  priority: { label: "Prioritarie", icon: Star },
  secondary: { label: "Secondarie", icon: Mail },
  unclassified: { label: "Da classificare", icon: HelpCircle },
};

const STORAGE_KEY = "funnemail_sidebar_order_v1";

interface StoredOrder {
  // slug -> { section override, position }
  [slug: string]: { section: Section; position: number };
}

function loadOrder(): StoredOrder {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as StoredOrder) : {};
  } catch {
    return {};
  }
}

function saveOrder(order: StoredOrder): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore quota */
  }
}

/** Applica preferenze utente su sezione/posizione. Le sezioni "speciali" (sorting/archive/unclassified) sono intoccabili. */
function applyUserOrder(folders: FunnemailGroupFolder[], order: StoredOrder): FunnemailGroupFolder[] {
  return folders.map((f) => {
    if (f.section === "unclassified" || f.section === "sorting" || f.section === "archive") return f;
    const pref = order[f.slug];
    if (!pref) return f;
    return { ...f, section: pref.section };
  });
}

function sortBySection(
  folders: FunnemailGroupFolder[],
  order: StoredOrder,
): Record<Section, FunnemailGroupFolder[]> {
  const buckets: Record<Section, FunnemailGroupFolder[]> = {
    operative: [],
    archive: [],
    sorting: [],
    priority: [],
    secondary: [],
    unclassified: [],
  };
  for (const f of folders) buckets[f.section].push(f);
  const defaultSorter = (section: Section) => (a: FunnemailGroupFolder, b: FunnemailGroupFolder) => {
    const pa = order[a.slug]?.section === section ? order[a.slug].position : Number.MAX_SAFE_INTEGER;
    const pb = order[b.slug]?.section === section ? order[b.slug].position : Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.sort_order - b.sort_order;
  };
  buckets.priority.sort(defaultSorter("priority"));
  buckets.secondary.sort(defaultSorter("secondary"));
  buckets.unclassified.sort((a, b) => a.sort_order - b.sort_order);
  buckets.operative.sort((a, b) => a.sort_order - b.sort_order);
  buckets.archive.sort((a, b) => a.sort_order - b.sort_order);
  buckets.sorting.sort((a, b) => a.sort_order - b.sort_order);
  return buckets;
}

interface SortableRowProps {
  folder: FunnemailGroupFolder;
  active: boolean;
  count: number;
  onSelect: (slug: string) => void;
  draggable: boolean;
}

function SortableRow({ folder, active, count, onSelect, draggable }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.slug,
    disabled: !draggable,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-md transition-colors",
        active ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted/50",
      )}
    >
      {draggable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-8 w-4 cursor-grab items-center justify-center text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
          aria-label={`Trascina ${folder.label}`}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onSelect(folder.slug)}
        className="flex flex-1 items-center justify-between gap-2 px-1.5 py-2 text-left text-xs"
      >
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <span className="shrink-0">{folder.icon ?? "📁"}</span>
          <span className="truncate">{folder.label}</span>
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold",
            active ? "bg-primary/20" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      </button>
    </div>
  );
}

export function InboxGroupsSidebar({ folders, counts, selectedFolder, totalCount: _totalCount, loading, onSelect, variant = "standalone" }: Props) {
  const [order, setOrder] = useState<StoredOrder>(() => loadOrder());
  const isDrawer = variant === "drawer";

  useEffect(() => {
    saveOrder(order);
  }, [order]);

  const arranged = useMemo(() => applyUserOrder(folders, order), [folders, order]);
  const grouped = useMemo(
    () => sortBySection(arranged, order),
    [arranged, order],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Mappa slug -> sezione corrente per il DnD
  const slugToSection = useMemo(() => {
    const m = new Map<string, Section>();
    for (const f of arranged) m.set(f.slug, f.section);
    return m;
  }, [arranged]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromSlug = String(active.id);
    const toSlug = String(over.id);
    const fromSection = slugToSection.get(fromSlug);
    const toSection = slugToSection.get(toSlug);
    if (!fromSection || !toSection) return;
    if (fromSection === "unclassified" || toSection === "unclassified") return;

    setOrder((prev) => {
      const next: StoredOrder = { ...prev };
      // Costruisci lista sezione di destinazione attuale
      const sectionList = grouped[toSection].map((f) => f.slug);
      let working: string[];
      if (fromSection === toSection) {
        const oldIdx = sectionList.indexOf(fromSlug);
        const newIdx = sectionList.indexOf(toSlug);
        if (oldIdx < 0 || newIdx < 0) return prev;
        working = arrayMove(sectionList, oldIdx, newIdx);
      } else {
        // rimuovi dalla origine, inserisci in destinazione nella posizione di toSlug
        const targetIdx = sectionList.indexOf(toSlug);
        working = [...sectionList];
        if (targetIdx < 0) working.push(fromSlug);
        else working.splice(targetIdx, 0, fromSlug);
      }
      working.forEach((slug, idx) => {
        next[slug] = { section: toSection, position: idx };
      });
      // Se fromSection diverso da toSection, riallinea anche la sezione di origine
      if (fromSection !== toSection) {
        const originList = grouped[fromSection].filter((f) => f.slug !== fromSlug);
        originList.forEach((f, idx) => {
          next[f.slug] = { section: fromSection, position: idx };
        });
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col bg-background/95",
        isDrawer
          ? "h-[calc(100vh-9rem)] rounded-md border border-border/60 bg-background/40"
          : "h-full w-[260px] shrink-0 border-r border-border",
      )}
    >
      {!isDrawer && (
        <div className="flex-shrink-0 border-b border-border px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Funny Mail
          </p>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-4 p-2">
            {(["operative", "sorting", "archive", "priority", "secondary", "unclassified"] as const).map((section) => {
              const items = grouped[section];
              if (items.length === 0 && (section === "priority" || section === "secondary" || section === "unclassified")) return null;
              const MetaIcon = SECTION_META[section].icon;
              return (
                <div key={section} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MetaIcon className="h-3 w-3" />
                      {SECTION_META[section].label}
                    </span>
                  </div>
                  <SortableContext items={items.map((f) => f.slug)} strategy={verticalListSortingStrategy}>
                    {items.length > 0 ? (
                      items.map((folder) => (
                        <SortableRow
                          key={folder.slug}
                          folder={folder}
                          active={selectedFolder === folder.slug}
                          count={counts[folder.slug] ?? 0}
                          onSelect={onSelect}
                          draggable={section === "priority" || section === "secondary"}
                        />
                      ))
                    ) : (
                      <div className="px-2 py-2 text-[11px] text-muted-foreground">
                        {loading ? "Caricamento cartelle…" : "Nessuna cartella"}
                      </div>
                    )}
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </DndContext>
      </ScrollArea>
    </aside>
  );
}
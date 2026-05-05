/**
 * SwapPanels — 2 pannelli affiancati con:
 *  - drag&drop sulla handle (⠿) per scambiarne l'ordine
 *  - modalità "expanded": un pannello (rightId) occupa tutta l'area, l'altro
 *    resta montato ma `hidden` (per preservare lo state interno)
 *
 * Presentational puro: lo stato (order, expandedId) è gestito dal parent.
 */
import { useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SwapPanelDef {
  id: string;
  title: ReactNode;
  toolbar?: ReactNode;
  content: ReactNode;
}

interface Props {
  panels: [SwapPanelDef, SwapPanelDef];
  order: [string, string];
  onReorder: (next: [string, string]) => void;
  expandedId?: string | null;
  className?: string;
}

export function SwapPanels({ panels, order, onReorder, expandedId = null, className }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const byId = (id: string) => panels.find((p) => p.id === id) ?? panels[0];

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function handleDragOver(e: React.DragEvent, id: string) {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoverId !== id) setHoverId(id);
  }
  function handleDrop(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (!draggingId || draggingId === id) {
      setDraggingId(null);
      setHoverId(null);
      return;
    }
    onReorder([order[1], order[0]]);
    setDraggingId(null);
    setHoverId(null);
  }
  function handleDragEnd() {
    setDraggingId(null);
    setHoverId(null);
  }

  function renderPanel(id: string, position: "left" | "right") {
    const p = byId(id);
    const isExpanded = expandedId === id;
    const isHidden = expandedId !== null && !isExpanded;
    return (
      <section
        key={id}
        onDragOver={(e) => handleDragOver(e, id)}
        onDrop={(e) => handleDrop(e, id)}
        className={cn(
          "flex min-h-0 flex-col border-l first:border-l-0 bg-card transition-all duration-200",
          isHidden && "hidden",
          isExpanded ? "flex-1" : "flex-1 basis-1/2",
          hoverId === id && draggingId && draggingId !== id && "ring-2 ring-primary/60 ring-inset",
          draggingId === id && "opacity-60",
        )}
      >
        <header className="flex items-center justify-between border-b bg-muted/30 px-2 py-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              draggable
              onDragStart={(e) => handleDragStart(e, id)}
              onDragEnd={handleDragEnd}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
              title="Trascina per scambiare i pannelli"
              aria-label={`Trascina ${typeof p.title === "string" ? p.title : "pannello"}`}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary truncate">
              {p.title}
            </div>
          </div>
          {p.toolbar && <div className="flex items-center gap-1 flex-shrink-0">{p.toolbar}</div>}
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">{p.content}</div>
      </section>
    );
  }

  return (
    <div className={cn("flex flex-1 min-h-0", className)}>
      {renderPanel(order[0], "left")}
      {renderPanel(order[1], "right")}
    </div>
  );
}
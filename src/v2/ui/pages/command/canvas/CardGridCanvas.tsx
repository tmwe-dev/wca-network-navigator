import { motion, AnimatePresence } from "framer-motion";
import { User, Clock, ArrowRight, Inbox, Wand2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { BulkAction } from "../tools/types";

const ease = [0.2, 0.8, 0.2, 1] as const;

export interface CardGridItem {
  id?: string;
  name: string;
  company: string;
  lastContact: string;
  action: string;
  avatar?: string;
  meta?: string[];
}

interface CardGridCanvasProps {
  items: CardGridItem[];
  title?: string;
  badge?: string;
  sourceLabel?: string;
  /** Selection */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleId?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onClearSelection?: () => void;
  bulkActions?: readonly BulkAction[];
  onBulkAction?: (action: BulkAction, ids: string[]) => void;
}

const CardGridCanvas = ({
  items, title, badge, sourceLabel,
  selectable = false, selectedIds, onToggleId, onSelectAll, onClearSelection,
  bulkActions, onBulkAction,
}: CardGridCanvasProps) => {
  const allIds = items.map((it) => it.id ?? "").filter(Boolean);
  const selectedCount = selectedIds?.size ?? 0;
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds?.has(id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider ${badge === "LIVE" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
          {badge ?? "DEMO"}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {title ?? `${items.length} contatti inattivi`}
        </span>
        {sourceLabel && (
          <span className="text-[9px] text-muted-foreground/60 font-mono ml-auto">{sourceLabel}</span>
        )}
        {selectable && allIds.length > 0 && (
          <button
            onClick={() => allSelected ? onClearSelection?.() : onSelectAll?.(allIds)}
            className="text-[9px] text-muted-foreground/70 hover:text-primary font-mono transition-colors ml-2"
          >
            {allSelected ? "deseleziona tutti" : "seleziona tutti"}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectable && selectedCount > 0 && bulkActions && bulkActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.35, ease }}
            className="float-panel-subtle p-3 rounded-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-3 h-3 text-primary/80" />
              <span className="text-[11px] font-light text-foreground">
                <span className="text-gradient-primary font-mono">{selectedCount}</span> selezionati
              </span>
              <button onClick={onClearSelection} className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors ml-2">
                annulla
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {bulkActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onBulkAction?.(action, Array.from(selectedIds ?? []))}
                  className="px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/50 text-[10px] text-foreground/90 font-light transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <p className="text-[12px] text-muted-foreground/60 font-light">Nessun contatto trovato</p>
          <p className="text-[10px] text-muted-foreground/40 font-light mt-1">Tutti i contatti sono stati aggiornati di recente</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item, i) => {
          const id = item.id ?? "";
          const isSel = selectable && id && selectedIds?.has(id);
          return (
            <motion.div
              key={item.id ?? `${item.name}-${i}`}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease }}
              className={`float-panel-interactive p-4 rounded-xl group cursor-pointer relative transition-colors ${isSel ? "ring-1 ring-primary/40 bg-primary/[0.03]" : ""}`}
            >
              {selectable && id && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.04, ease }}
                  className="absolute top-2 right-2"
                >
                  <Checkbox
                    checked={!!isSel}
                    onCheckedChange={() => onToggleId?.(id)}
                    className="h-3.5 w-3.5 border-border/40 data-[state=checked]:bg-primary/80 data-[state=checked]:border-primary/80"
                  />
                </motion.div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-light text-foreground truncate pr-6">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{item.company}</div>
                  {item.meta && item.meta.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {item.meta.map((m, idx) => (
                        <span key={idx} className="text-[8px] text-muted-foreground/60 font-mono bg-secondary/10 px-1 py-0.5 rounded">{m}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                    <span className="text-[9px] text-muted-foreground font-mono">{item.lastContact}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/10 flex items-center justify-between">
                <span className="text-[9px] text-primary/70 font-light">{item.action}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/50 transition-colors duration-300" />
              </div>
            </motion.div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default CardGridCanvas;

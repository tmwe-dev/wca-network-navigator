import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Wand2 } from "lucide-react";
import type { BulkAction } from "../tools/types";

const ease = [0.2, 0.8, 0.2, 1] as const;

export interface TableCanvasColumn {
  key: string;
  label: string;
}

interface TableCanvasProps {
  columns: TableCanvasColumn[];
  rows: Record<string, string | number | null>[];
  kpis?: { label: string; value: string }[];
  isLive?: boolean;
  meta?: { count: number; sourceLabel: string };
  /** Selection */
  selectable?: boolean;
  idField?: string;
  selectedIds?: Set<string>;
  onToggleId?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onClearSelection?: () => void;
  bulkActions?: readonly BulkAction[];
  onBulkAction?: (action: BulkAction, ids: string[]) => void;
}

const TableCanvas = ({
  columns, rows, kpis, isLive, meta,
  selectable = false, idField = "id",
  selectedIds, onToggleId, onSelectAll, onClearSelection,
  bulkActions, onBulkAction,
}: TableCanvasProps) => {
  const allIds = rows.map((r) => String(r[idField] ?? "")).filter(Boolean);
  const selectedCount = selectedIds?.size ?? 0;
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds?.has(id));

  return (
    <div className="space-y-4">
      {/* Badge row */}
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider ${
          isLive ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
        }`}>
          {isLive ? "LIVE" : "DEMO"}
        </span>
        {meta && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {meta.count} risultati · {meta.sourceLabel}
          </span>
        )}
      </div>

      {/* KPI cards */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease }}
              className="float-panel-subtle p-3 rounded-xl text-center"
            >
              <div className="text-lg font-extralight tracking-tight text-gradient-primary">{kpi.value}</div>
              <div className="text-[8px] text-muted-foreground mt-1 tracking-wider uppercase font-mono">{kpi.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bulk action bar (only when something selected) */}
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
              <button
                onClick={onClearSelection}
                className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors ml-2"
              >
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

      {/* Table */}
      {rows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[12px] text-muted-foreground font-light">Nessun risultato trovato.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[9px] text-muted-foreground font-mono tracking-wider">
                {selectable && (
                  <th className="text-left pb-3 font-normal w-6">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => {
                        if (v) onSelectAll?.(allIds);
                        else onClearSelection?.();
                      }}
                      className="h-3 w-3 border-border/40 data-[state=checked]:bg-primary/80 data-[state=checked]:border-primary/80"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th key={col.key} className="text-left pb-3 font-normal">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const id = String(row[idField] ?? "");
                const isSel = selectable && id && selectedIds?.has(id);
                return (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.03, duration: 0.3, ease }}
                    className={`border-t border-border/20 transition-colors ${isSel ? "bg-primary/[0.04]" : ""}`}
                  >
                    {selectable && (
                      <td className="py-2">
                        <Checkbox
                          checked={!!isSel}
                          onCheckedChange={() => id && onToggleId?.(id)}
                          disabled={!id}
                          className="h-3 w-3 border-border/40 data-[state=checked]:bg-primary/80 data-[state=checked]:border-primary/80"
                        />
                      </td>
                    )}
                    {columns.map((col, j) => (
                      <td key={col.key} className={`py-2 text-[11px] ${j === 0 ? "font-light text-foreground" : "text-muted-foreground"}`}>
                        {row[col.key] != null ? String(row[col.key]) : "—"}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TableCanvas;

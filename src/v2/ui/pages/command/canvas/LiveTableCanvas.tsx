import { motion } from "framer-motion";
import { Download, X } from "lucide-react";
import type { ToolResultColumn } from "../tools/types";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface LiveTableCanvasProps {
  title: string;
  columns: ToolResultColumn[];
  rows: Record<string, string | number | null>[];
  sourceLabel?: string;
  count?: number;
  onClose: () => void;
}

/**
 * Generic live table that respects the columns the tool actually returned,
 * instead of forcing a fixed Partner/Sector/Revenue/Days/Score schema.
 * This lets each tool (dashboard, contacts, partners, queue, …) display
 * its own real labels in plain language.
 */
export default function LiveTableCanvas({
  title,
  columns,
  rows,
  sourceLabel,
  count,
  onClose,
}: LiveTableCanvasProps) {
  const visibleCols = columns.length > 0
    ? columns
    : Object.keys(rows[0] ?? {}).map((k) => ({ key: k, label: k }));

  return (
    <div
      className="h-full flex flex-col rounded-2xl p-6"
      style={{
        background: "hsl(var(--card) / 0.75)",
        backdropFilter: "blur(40px) saturate(1.1)",
        border: "1px solid hsl(var(--foreground) / 0.12)",
        boxShadow: "0 0 80px hsl(var(--primary) / 0.03), 0 30px 60px -20px hsl(0 0% 0% / 0.65)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-success/20 text-success">
            LIVE
          </span>
          <h3 className="text-[13px] font-light text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="text-muted-foreground hover:text-foreground p-1.5">
            <Download className="w-3 h-3" />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {(sourceLabel || count != null) && (
        <div className="text-[10px] text-muted-foreground/80 mb-3">
          {count != null ? `${count} risultati` : null}
          {count != null && sourceLabel ? " · " : ""}
          {sourceLabel ? `Fonte: ${sourceLabel}` : null}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[12px] text-muted-foreground/60 font-light">
              Nessun risultato trovato.
            </p>
            <p className="text-[10px] text-muted-foreground/50 font-light mt-1">
              Prova a riformulare la richiesta in modo più ampio.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[9px] text-muted-foreground/90 font-mono tracking-wider uppercase">
                {visibleCols.map((c) => (
                  <th key={c.key} className="text-left pb-3 font-normal">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.3, ease }}
                  className="border-t border-border/[0.12]"
                >
                  {visibleCols.map((c) => {
                    const v = row[c.key];
                    return (
                      <td
                        key={c.key}
                        className="py-2.5 text-[12px] text-foreground/95 font-light"
                      >
                        {v == null || v === "" ? (
                          <span className="text-muted-foreground/50">—</span>
                        ) : (
                          String(v)
                        )}
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
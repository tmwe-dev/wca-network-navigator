import { motion } from "framer-motion";

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
}

const TableCanvas = ({ columns, rows, kpis, isLive, meta }: TableCanvasProps) => (
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
              {columns.map((col) => (
                <th key={col.key} className="text-left pb-3 font-normal">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.03, duration: 0.3, ease }}
                className="border-t border-border/20"
              >
                {columns.map((col, j) => (
                  <td key={col.key} className={`py-2 text-[11px] ${j === 0 ? "font-light text-foreground" : "text-muted-foreground"}`}>
                    {row[col.key] != null ? String(row[col.key]) : "—"}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default TableCanvas;

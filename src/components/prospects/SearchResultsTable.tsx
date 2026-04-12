import { useState, useMemo } from "react";
import { Check, CheckCheck, Filter, RefreshCw, Database, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { t } from "@/components/download/theme";

export interface SearchResult {
  name: string;
  url: string;
  piva?: string;
  city?: string;
  inDb?: boolean;
}

interface Props {
  results: SearchResult[];
  selected: Set<string>;
  onToggle: (url: string) => void;
  onSelectAll: () => void;
  onSelectNew: () => void;
  onDeselectAll: () => void;
  isDark: boolean;
  isLoading?: boolean;
}

export function SearchResultsTable({ results, selected, onToggle, onSelectAll, onSelectNew, onDeselectAll, isDark, isLoading }: Props) {
  const th = t(isDark);
  const [showInDb, setShowInDb] = useState(true);

  const visible = useMemo(() => showInDb ? results : results.filter(r => !r.inDb), [results, showInDb]);
  const inDbCount = results.filter(r => r.inDb).length;
  const newCount = results.length - inDbCount;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b flex-wrap ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
        <button onClick={onSelectAll} className={`text-[10px] px-2 py-1 rounded-lg transition-all ${isDark ? "bg-white/5 hover:bg-white/10 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
          <CheckCheck className="w-3 h-3 inline mr-1" />Tutti
        </button>
        <button onClick={onSelectNew} className={`text-[10px] px-2 py-1 rounded-lg transition-all ${isDark ? "bg-primary/15 hover:bg-primary/25 text-primary" : "bg-primary/10 hover:bg-primary/15 text-primary"}`}>
          Solo nuovi ({newCount})
        </button>
        <button onClick={onDeselectAll} className={`text-[10px] px-2 py-1 rounded-lg transition-all ${isDark ? "bg-white/5 hover:bg-white/10 text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-500"}`}>
          <X className="w-3 h-3 inline mr-1" />Nessuno
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowInDb(!showInDb)}
            className={`text-[10px] px-2 py-1 rounded-lg transition-all flex items-center gap-1 ${
              showInDb
                ? isDark ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : isDark ? "bg-white/5 text-slate-500" : "bg-slate-100 text-slate-400"
            }`}
          >
            <Database className="w-3 h-3" />
            {showInDb ? `Mostra in DB (${inDbCount})` : `Nascosti (${inDbCount})`}
          </button>
          <Badge variant="outline" className={`text-[10px] ${isDark ? "border-primary/30 text-primary" : "border-primary/20 text-primary"}`}>
            {selected.size} selezionati
          </Badge>
        </div>
      </div>

      {/* Results list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {visible.map((r, i) => (
            <button
              key={r.url}
              onClick={() => onToggle(r.url)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                selected.has(r.url)
                  ? isDark ? "bg-primary/10 border border-primary/20" : "bg-primary/5 border border-primary/20"
                  : isDark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50"
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                selected.has(r.url) ? "bg-primary border-primary" : isDark ? "border-border" : "border-border"
              }`}>
                {selected.has(r.url) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className={`text-[11px] font-mono w-6 ${th.dim}`}>{i + 1}</span>
              <span className={`text-xs font-medium truncate flex-1 ${th.h2}`}>{r.name}</span>
              {r.city && <span className={`text-[10px] ${th.dim}`}>{r.city}</span>}
              {r.piva && <span className={`text-[10px] font-mono ${th.dim}`}>{r.piva}</span>}
              {r.inDb && (
                <Badge variant="secondary" className={`text-[9px] shrink-0 ${isDark ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600"}`}>
                  ✓ In DB
                </Badge>
              )}
            </button>
          ))}
          {visible.length === 0 && !isLoading && (
            <div className={`text-center py-8 text-xs ${th.dim}`}>
              {results.length === 0 ? "Nessun risultato" : "Tutti i risultati sono già nel database"}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * MainMenu — UNICO menu del sistema.
 * Elenco piatto di tutte le maschere, nessun raggruppamento.
 * Modalità "Riordina": frecce su/giù, ordine memorizzato per utente.
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronUp, ChevronDown, ArrowUpDown, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMenuOrder } from "@/v2/navigation/useMenuOrder";

interface Props {
  readonly onNavigate?: () => void;
}

export function MainMenu({ onNavigate }: Props): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, muovi, reimposta } = useMenuOrder();
  const [riordina, setRiordina] = React.useState(false);
  const [q, setQ] = React.useState("");

  const filtrati = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.label.toLowerCase().includes(s) || i.path.toLowerCase().includes(s));
  }, [items, q]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="main-menu">
      <div className="flex items-center gap-2 border-b border-border/50 p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca maschera…"
            aria-label="Cerca maschera"
            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setRiordina((v) => !v)}
          aria-pressed={riordina}
          title="Riordina il menu"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border border-border transition-colors",
            riordina ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
        {riordina && (
          <button
            type="button"
            onClick={reimposta}
            title="Ripristina ordine originale"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent/50"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1" aria-label="Menu principale">
        {filtrati.map((item) => (
          <div key={item.path} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                navigate(item.path);
                onNavigate?.();
              }}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                isActive(item.path)
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <span className="truncate">{item.label}</span>
              {item.stato === "sviluppo" && (
                <span className="ml-auto shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                  in sviluppo
                </span>
              )}
            </button>
            {riordina && !q && (
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  aria-label={`Sposta ${item.label} in alto`}
                  onClick={() => muovi(item.path, -1)}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent/50"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Sposta ${item.label} in basso`}
                  onClick={() => muovi(item.path, 1)}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent/50"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
        {filtrati.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground">Nessuna maschera.</div>}
      </nav>
    </div>
  );
}

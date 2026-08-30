/**
 * SystemGalaxyPage — mappa 3D dell'intero sistema come galassia navigabile.
 * UI pura: nessuna scrittura, solo lettura del grafo derivato dal codice.
 */
import * as React from "react";
import { Suspense, lazy, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildSystemGraph, GALAXY_DOMAINS, type GalaxyKind } from "@/v2/galaxy/systemGraph";
import type { PositionedNode } from "@/v2/galaxy/layout";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

const GalaxyScene = lazy(() => import("@/v2/galaxy/GalaxyScene").then((m) => ({ default: m.GalaxyScene })));

const KIND_LABEL: Record<GalaxyKind, string> = {
  core: "Nucleo",
  hub: "Braccio",
  brain: "Cervello AI",
  orchestrator: "Orchestratore",
  source: "Origine dati",
  surface: "Superficie (pagina)",
  store: "Store dati",
  external: "Funzione di sistema",
};


const ALL_DOMAINS = GALAXY_DOMAINS.map((d) => d.id);

export function SystemGalaxyPage(): React.ReactElement {
  const navigate = useNavigate();
  const graph = useMemo(() => buildSystemGraph(), []);
  const [selected, setSelected] = useState<PositionedNode | null>(null);
  const [hovered, setHovered] = useState<PositionedNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [visibleDomains, setVisibleDomains] = useState<readonly string[]>(ALL_DOMAINS);

  const handleSelect = useCallback((n: PositionedNode | null) => setSelected(n), []);
  const handleHover = useCallback((n: PositionedNode | null) => setHovered(n), []);

  const toggleDomain = useCallback((id: string) => {
    setVisibleDomains((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }, []);

  const neighbours = useMemo(() => {
    if (!selected) return [];
    const ids = new Set<string>();
    for (const l of graph.links) {
      if (l.from === selected.id) ids.add(l.to);
      else if (l.to === selected.id) ids.add(l.from);
    }
    return graph.nodes.filter((n) => ids.has(n.id)).slice(0, 24);
  }, [selected, graph]);

  const domainMeta = selected ? GALAXY_DOMAINS.find((d) => d.id === selected.domain) : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#04060f] text-white">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
          </div>
        }
      >
        <GalaxyScene
          graph={graph}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
          onHover={handleHover}
          autoRotate={autoRotate}
          visibleDomains={visibleDomains}
        />
      </Suspense>

      {/* HUD in alto a sinistra */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[300px] space-y-3">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
          <h1 className="text-sm font-semibold tracking-[0.18em] text-white/90">GALASSIA DI SISTEMA</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            Ogni punto è un pezzo reale del programma. Ruota, avvicina, tocca un nodo.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <Stat label="Cervelli AI" value={graph.stats.brains} />
            <Stat label="Origini dati" value={graph.stats.sources} />
            <Stat label="Superfici" value={graph.stats.surfaces} />
            <Stat label="Store" value={graph.stats.stores} />
            <Stat label="Funzioni server" value={graph.stats.edgeFunctions} />
            <Stat label="Connessioni" value={graph.stats.links} />
          </dl>
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className="mt-3 w-full rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            {autoRotate ? "Ferma rotazione" : "Riprendi rotazione"}
          </button>
        </div>

        {/* Dropdown multi-selezione bracci */}
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-md">
          <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/45">Bracci visibili</p>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-white/80 transition-colors hover:border-white/40"
              >
                <span>
                  {visibleDomains.length === ALL_DOMAINS.length
                    ? "Tutti i bracci"
                    : `${visibleDomains.length} di ${ALL_DOMAINS.length} selezionati`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 border-white/10 bg-black/85 p-2 text-white backdrop-blur-md">
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleDomains(ALL_DOMAINS)}
                  className="flex-1 rounded-md border border-white/15 px-2 py-1 text-[10px] text-white/70 hover:border-white/40"
                >
                  Tutti
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleDomains([])}
                  className="flex-1 rounded-md border border-white/15 px-2 py-1 text-[10px] text-white/70 hover:border-white/40"
                >
                  Nessuno
                </button>
              </div>
              <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                {GALAXY_DOMAINS.map((d) => (
                  <li key={d.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-white/80 hover:bg-white/10">
                      <Checkbox
                        checked={visibleDomains.includes(d.id)}
                        onCheckedChange={() => toggleDomain(d.id)}
                        className="border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-black"
                      />
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: `hsl(${d.hsl.replace(/ /g, ", ")})` }}
                      />
                      {d.label}
                    </label>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      </div>


      {/* Etichetta hover */}
      {hovered && !selected && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px] text-white/80 backdrop-blur-md">
          {hovered.label} · {KIND_LABEL[hovered.kind]}
        </div>
      )}

      {/* Pannello dettaglio */}
      {selected && (
        <aside className="absolute right-4 top-4 bottom-4 w-[320px] max-w-[85vw] overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{KIND_LABEL[selected.kind]}</p>
              <h2 className="mt-0.5 break-words text-base font-semibold text-white">{selected.label}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md border border-white/15 px-2 py-0.5 text-xs text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>

          {domainMeta && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-white/65">
              <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${domainMeta.hsl.replace(/ /g, ", ")})` }} />
              {domainMeta.label}
            </div>
          )}

          <p className="mt-3 text-[12px] leading-relaxed text-white/70">{selected.detail}</p>

          {selected.path && (
            <Button size="sm" className="mt-4 w-full" onClick={() => navigate(selected.path as string)}>
              Apri {selected.label}
            </Button>
          )}

          {neighbours.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                Connessioni ({neighbours.length})
              </p>
              <ul className="space-y-1">
                {neighbours.map((n) => (
                  <li key={n.id}>
                    <span className="block truncate rounded-md px-2 py-1 text-[11px] text-white/70">
                      {n.label} <span className="text-white/35">· {KIND_LABEL[n.kind]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-white/40">{label}</dt>
      <dd className="text-sm font-semibold text-white/90">{value}</dd>
    </div>
  );
}

export default SystemGalaxyPage;

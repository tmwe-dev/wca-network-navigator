/**
 * Galassia 3D V3 — mappa vivente della sola V3: pagine, hook, livello dati,
 * funzioni backend e tabelle, con le sinapsi reali derivate dagli import.
 * UI pura: nessuna scrittura, solo lettura del grafo generato dal codice.
 */
import * as React from "react";
import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildV3Graph, V3_GRAPH_GENERATED_AT } from "@/v3/galaxy/v3Graph";
import { V3_GALAXY_DOMAINS, type V3GalaxyKind } from "@/v3/galaxy/types";
import type { V3PositionedNode } from "@/v3/galaxy/layout";

const V3GalaxyScene = lazy(() =>
  import("@/v3/galaxy/V3GalaxyScene").then((m) => ({ default: m.V3GalaxyScene })),
);

const KIND_LABEL: Record<V3GalaxyKind, string> = {
  pagina: "Maschera",
  hook: "Hook (logica)",
  logica: "Logica di modulo",
  dal: "Livello dati",
  ui: "Componente standard",
  app: "Guscio applicativo",
  rpc: "Funzione backend",
  tabella: "Tabella",
};

const ALL_DOMAINS = V3_GALAXY_DOMAINS.map((d) => d.id);

export function Galassia3DPage(): React.ReactElement {
  const navigate = useNavigate();
  const graph = useMemo(() => buildV3Graph(), []);
  const [selected, setSelected] = useState<V3PositionedNode | null>(null);
  const [hovered, setHovered] = useState<V3PositionedNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [visibleDomains, setVisibleDomains] = useState<readonly string[]>(ALL_DOMAINS);

  const handleSelect = useCallback((n: V3PositionedNode | null) => setSelected(n), []);
  const handleHover = useCallback((n: V3PositionedNode | null) => setHovered(n), []);
  const toggleDomain = useCallback((id: string) => {
    setVisibleDomains((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }, []);

  const synapses = useMemo(() => {
    if (!selected) return [] as { label: string; nodes: { id: string; label: string }[] }[];
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const groups = new Map<string, { label: string; nodes: { id: string; label: string }[] }>();
    for (const l of graph.links) {
      const outgoing = l.from === selected.id;
      const incoming = l.to === selected.id;
      if (!outgoing && !incoming) continue;
      const other = byId.get(outgoing ? l.to : l.from);
      if (!other) continue;
      const label =
        l.relation === "usa"
          ? outgoing
            ? "Usa"
            : "Usato da"
          : l.relation === "invoca"
            ? outgoing
              ? "Invoca"
              : "Invocata da"
            : outgoing
              ? "Legge / scrive"
              : "Usata da";
      const g = groups.get(label) ?? { label, nodes: [] };
      g.nodes.push({ id: other.id, label: other.label });
      groups.set(label, g);
    }
    return [...groups.values()];
  }, [selected, graph]);

  const synapseCount = synapses.reduce((s, g) => s + g.nodes.length, 0);
  const domainMeta = selected ? V3_GALAXY_DOMAINS.find((d) => d.id === selected.module) : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#04060f] text-white">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
          </div>
        }
      >
        <V3GalaxyScene
          graph={graph}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
          onHover={handleHover}
          autoRotate={autoRotate}
          visibleDomains={visibleDomains}
        />
      </Suspense>

      <div className="pointer-events-none absolute left-4 top-4 max-w-[300px] space-y-3">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
          <h1 className="text-sm font-semibold tracking-[0.18em] text-white/90">GALASSIA V3</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            Solo la V3: maschere, hook, livello dati, backend. Ogni linea è un import reale.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <Stat label="Maschere" value={graph.stats.pagine} />
            <Stat label="Hook" value={graph.stats.hook} />
            <Stat label="Moduli dati" value={graph.stats.dal} />
            <Stat label="Componenti UI" value={graph.stats.ui} />
            <Stat label="Funzioni backend" value={graph.stats.rpc} />
            <Stat label="Tabelle" value={graph.stats.tabelle} />
            <Stat label="Sinapsi" value={graph.stats.sinapsi} />
          </dl>
          <p className="mt-2 text-[10px] text-white/35">
            Grafo generato il {new Date(V3_GRAPH_GENERATED_AT).toLocaleString("it-IT")}
          </p>

          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className="mt-3 w-full rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            {autoRotate ? "Ferma rotazione" : "Riprendi rotazione"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/v3/galassia")}
            className="mt-2 w-full rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            ← Standard grafico V3
          </button>
        </div>

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
                {V3_GALAXY_DOMAINS.map((d) => (
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

      {hovered && !selected && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px] text-white/80 backdrop-blur-md">
          {hovered.label} · {KIND_LABEL[hovered.kind]}
        </div>
      )}

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

          <p className="mt-3 break-words text-[12px] leading-relaxed text-white/70">{selected.detail}</p>

          {selected.path && (
            <Button size="sm" className="mt-4 w-full" onClick={() => navigate(selected.path as string)}>
              Apri {selected.label}
            </Button>
          )}

          {synapseCount > 0 && (
            <div className="mt-5 space-y-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{synapseCount} sinapsi</p>
              {synapses.map((g) => (
                <div key={g.label}>
                  <p className="mb-1 text-[11px] font-medium text-white/70">{g.label}</p>
                  <ul className="space-y-0.5">
                    {g.nodes.map((n) => (
                      <li key={`${g.label}-${n.id}`} className="truncate text-[11px] text-white/50" title={n.id}>
                        · {n.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-white/45">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-white/90">{value}</dd>
    </>
  );
}

export default Galassia3DPage;

/** Costruzione del grafo della Galassia V3 dal file generato. */
import { V3_GRAPH_NODES, V3_GRAPH_LINKS, V3_GRAPH_GENERATED_AT } from "./graph.generated";
import type { V3Graph } from "./types";

export { V3_GRAPH_GENERATED_AT };

export function buildV3Graph(): V3Graph {
  const nodes = V3_GRAPH_NODES;
  const ids = new Set(nodes.map((n) => n.id));
  const links = V3_GRAPH_LINKS.filter((l) => ids.has(l.from) && ids.has(l.to));
  const count = (k: string) => nodes.filter((n) => n.kind === k).length;
  return {
    nodes,
    links,
    stats: {
      pagine: count("pagina"),
      hook: count("hook"),
      dal: count("dal"),
      ui: count("ui"),
      rpc: count("rpc"),
      tabelle: count("tabella"),
      sinapsi: links.length,
    },
  };
}

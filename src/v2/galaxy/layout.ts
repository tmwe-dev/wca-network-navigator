/** Layout deterministico della galassia: ogni nodo su un braccio a spirale. */
import * as THREE from "three";
import { GALAXY_DOMAINS, type GalaxyNode, type SystemGraph } from "./systemGraph";

/** PRNG deterministico da stringa (nessun Math.random: layout stabile tra i render). */
function hash01(str: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export interface PositionedNode extends GalaxyNode {
  readonly position: THREE.Vector3;
  readonly color: THREE.Color;
}

const ARM_TWIST = 1.15;
const INNER = 4.2;
const OUTER = 15;

export function layoutGraph(graph: SystemGraph): {
  nodes: readonly PositionedNode[];
  byId: ReadonlyMap<string, PositionedNode>;
} {
  const domainIndex = new Map(GALAXY_DOMAINS.map((d, i) => [d.id, i]));
  const domainColor = new Map(GALAXY_DOMAINS.map((d) => [d.id, new THREE.Color(`hsl(${d.hsl.replace(/ /g, ", ")})`)]));

  const perDomain = new Map<string, GalaxyNode[]>();
  for (const n of graph.nodes) {
    if (n.kind === "hub") continue;
    const arr = perDomain.get(n.domain) ?? [];
    arr.push(n);
    perDomain.set(n.domain, arr);
  }

  const out: PositionedNode[] = [];

  for (const n of graph.nodes) {
    const di = domainIndex.get(n.domain) ?? 0;
    const base = (di / GALAXY_DOMAINS.length) * Math.PI * 2;
    const color = domainColor.get(n.domain) ?? new THREE.Color("#ffffff");

    if (n.kind === "hub") {
      const r = 2.9;
      out.push({
        ...n,
        position: new THREE.Vector3(Math.cos(base) * r, 0, Math.sin(base) * r),
        color,
      });
      continue;
    }

    const siblings = perDomain.get(n.domain) ?? [];
    const idx = siblings.indexOf(n);
    const t = siblings.length > 1 ? idx / (siblings.length - 1) : 0.5;
    const jitterA = (hash01(n.id, 1) - 0.5) * 0.42;
    const jitterR = (hash01(n.id, 2) - 0.5) * 1.9;
    const r = INNER + t * (OUTER - INNER) + jitterR;
    const a = base + t * ARM_TWIST + jitterA;
    const y = (hash01(n.id, 3) - 0.5) * (1.1 + t * 1.6);

    out.push({
      ...n,
      position: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
      color: color.clone().lerp(new THREE.Color("#ffffff"), n.kind === "source" ? 0.35 : 0.08),
    });
  }

  return { nodes: out, byId: new Map(out.map((n) => [n.id, n])) };
}

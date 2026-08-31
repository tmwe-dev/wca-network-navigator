/** Layout deterministico della galassia V3: un braccio per modulo. */
import * as THREE from "three";
import { V3_GALAXY_DOMAINS, type V3GalaxyNode, type V3Graph } from "./types";

function hash01(str: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export interface V3PositionedNode extends V3GalaxyNode {
  readonly position: THREE.Vector3;
  readonly color: THREE.Color;
}

const ARM_TWIST = 1.05;
const INNER = 3.6;
const OUTER = 14;

export function layoutV3Graph(graph: V3Graph): {
  nodes: readonly V3PositionedNode[];
  byId: ReadonlyMap<string, V3PositionedNode>;
} {
  const domainIndex = new Map(V3_GALAXY_DOMAINS.map((d, i) => [d.id, i]));
  const domainColor = new Map(
    V3_GALAXY_DOMAINS.map((d) => [d.id, new THREE.Color(`hsl(${d.hsl.replace(/ /g, ", ")})`)]),
  );

  const perDomain = new Map<string, V3GalaxyNode[]>();
  for (const n of graph.nodes) {
    const arr = perDomain.get(n.module) ?? [];
    arr.push(n);
    perDomain.set(n.module, arr);
  }

  const out: V3PositionedNode[] = [];
  for (const n of graph.nodes) {
    const di = domainIndex.get(n.module) ?? 0;
    const base = (di / V3_GALAXY_DOMAINS.length) * Math.PI * 2;
    const color = domainColor.get(n.module) ?? new THREE.Color("#ffffff");

    const siblings = perDomain.get(n.module) ?? [];
    const idx = siblings.indexOf(n);
    const t = siblings.length > 1 ? idx / (siblings.length - 1) : 0.5;
    const jitterA = (hash01(n.id, 1) - 0.5) * 0.4;
    const jitterR = (hash01(n.id, 2) - 0.5) * 1.7;
    const r = INNER + t * (OUTER - INNER) + jitterR;
    const a = base + t * ARM_TWIST + jitterA;
    const y = (hash01(n.id, 3) - 0.5) * (1 + t * 1.5);

    out.push({
      ...n,
      position: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
      color: color.clone().lerp(new THREE.Color("#ffffff"), n.kind === "pagina" ? 0.3 : 0.05),
    });
  }

  return { nodes: out, byId: new Map(out.map((n) => [n.id, n])) };
}

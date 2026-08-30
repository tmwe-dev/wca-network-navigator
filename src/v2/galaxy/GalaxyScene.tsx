/**
 * GalaxyScene — rendering 3D della galassia di sistema (solo presentazione).
 */
import * as React from "react";
import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import type { SystemGraph } from "./systemGraph";
import { GALAXY_DOMAINS } from "./systemGraph";
import { layoutGraph, type PositionedNode } from "./layout";

const NODE_GEOMETRY = new THREE.SphereGeometry(1, 10, 10);

interface SceneProps {
  graph: SystemGraph;
  selectedId: string | null;
  onSelect: (node: PositionedNode | null) => void;
  onHover: (node: PositionedNode | null) => void;
  autoRotate: boolean;
}

function Core({ pulse = true }: { pulse?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current || !pulse) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.06;
    ref.current.scale.setScalar(s);
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshBasicMaterial color="#fff3cf" />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.1, 32, 32]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.4, 32, 32]} />
        <meshBasicMaterial color="#7aa2ff" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={40} distance={40} color="#ffd88a" />
    </group>
  );
}

/** Polvere della galassia: nube di punti che segue i bracci. */
function Dust() {
  const geo = useMemo(() => {
    const N = 5200;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const arm = i % GALAXY_DOMAINS.length;
      const base = (arm / GALAXY_DOMAINS.length) * Math.PI * 2;
      const t = Math.pow(Math.random(), 0.65);
      const r = 2.5 + t * 17;
      const a = base + t * 1.15 + (Math.random() - 0.5) * 0.55;
      pos[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * 1.2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * (0.8 + t * 2.4);
      pos[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 1.2;
      c.set(`hsl(${GALAXY_DOMAINS[arm].hsl.replace(/ /g, ", ")})`).lerp(new THREE.Color("#0b1030"), 0.45);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  return (
    <points geometry={geo}>
      <pointsMaterial size={0.075} vertexColors transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Links({ graph, byId, selectedId }: { graph: SystemGraph; byId: ReadonlyMap<string, PositionedNode>; selectedId: string | null }) {
  const base = useMemo(() => {
    const pts: number[] = [];
    const cols: number[] = [];
    for (const l of graph.links) {
      const a = byId.get(l.from);
      const b = byId.get(l.to);
      if (!a || !b) continue;
      pts.push(a.position.x, a.position.y, a.position.z, b.position.x, b.position.y, b.position.z);
      cols.push(a.color.r, a.color.g, a.color.b, b.color.r, b.color.g, b.color.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, [graph, byId]);

  const highlight = useMemo(() => {
    if (!selectedId) return null;
    const pts: number[] = [];
    for (const l of graph.links) {
      if (l.from !== selectedId && l.to !== selectedId) continue;
      const a = byId.get(l.from);
      const b = byId.get(l.to);
      if (!a || !b) continue;
      pts.push(a.position.x, a.position.y, a.position.z, b.position.x, b.position.y, b.position.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [graph, byId, selectedId]);

  return (
    <>
      <lineSegments geometry={base}>
        <lineBasicMaterial vertexColors transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {highlight && (
        <lineSegments geometry={highlight}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      )}
    </>
  );
}

function Nodes({
  nodes,
  selectedId,
  onSelect,
  onHover,
}: {
  nodes: readonly PositionedNode[];
  selectedId: string | null;
  onSelect: (n: PositionedNode | null) => void;
  onHover: (n: PositionedNode | null) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hoveredRef = useRef<number | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const paintable = useMemo(() => nodes.filter((n) => n.kind !== "core"), [nodes]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    paintable.forEach((n, i) => mesh.setColorAt(i, n.color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [paintable]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    paintable.forEach((n, i) => {
      const isSel = n.id === selectedId;
      const isHover = hoveredRef.current === i;
      const pulse = isSel ? 1.7 + Math.sin(t * 3) * 0.25 : isHover ? 1.5 : 1;
      const s = (0.055 + n.weight * 0.055) * pulse;
      dummy.position.copy(n.position);
      dummy.position.y += Math.sin(t * 0.5 + n.position.x) * 0.03;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = e.instanceId ?? null;
    if (id === hoveredRef.current) return;
    hoveredRef.current = id;
    onHover(id === null ? null : paintable[id]);
    document.body.style.cursor = id === null ? "auto" : "pointer";
  };

  const handleOut = () => {
    hoveredRef.current = null;
    onHover(null);
    document.body.style.cursor = "auto";
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[NODE_GEOMETRY, undefined, paintable.length]}
      onPointerMove={handleMove}
      onPointerOut={handleOut}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null) onSelect(paintable[e.instanceId]);
      }}
    >
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

function HubLabels({ nodes, onSelect }: { nodes: readonly PositionedNode[]; onSelect: (n: PositionedNode) => void }) {
  return (
    <>
      {nodes
        .filter((n) => n.kind === "hub")
        .map((n) => (
          <Html key={n.id} position={[n.position.x, n.position.y + 0.75, n.position.z]} center distanceFactor={22}>
            <button
              type="button"
              onClick={() => onSelect(n)}
              className="whitespace-nowrap rounded-full border border-white/25 bg-black/50 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-sm transition-colors hover:border-white/60 hover:bg-black/70"
            >
              {n.label}
            </button>
          </Html>
        ))}
    </>
  );
}

function Rotator({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current && enabled) ref.current.rotation.y += delta * 0.045;
  });
  return <group ref={ref}>{children}</group>;
}

export function GalaxyScene({ graph, selectedId, onSelect, onHover, autoRotate }: SceneProps) {
  const { nodes, byId } = useMemo(() => layoutGraph(graph), [graph]);

  return (
    <Canvas
      camera={{ position: [0, 13, 26], fov: 55 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#04060f"]} />
      <fog attach="fog" args={["#04060f", 34, 68]} />
      <ambientLight intensity={0.35} />
      <Stars radius={90} depth={60} count={6000} factor={4} saturation={0} fade speed={0.6} />
      <Rotator enabled={autoRotate}>
        <Core />
        <Dust />
        <Links graph={graph} byId={byId} selectedId={selectedId} />
        <Nodes nodes={nodes} selectedId={selectedId} onSelect={onSelect} onHover={onHover} />
        <HubLabels nodes={nodes} onSelect={onSelect} />
      </Rotator>
      <OrbitControls enablePan={false} minDistance={6} maxDistance={60} enableDamping dampingFactor={0.06} />
    </Canvas>
  );
}

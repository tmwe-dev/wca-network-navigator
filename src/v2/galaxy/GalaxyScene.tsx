/**
 * GalaxyScene — rendering 3D della galassia di sistema (solo presentazione).
 */
import * as React from "react";
import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { SystemGraph } from "./systemGraph";
import { GALAXY_DOMAINS } from "./systemGraph";
import { layoutGraph, type PositionedNode } from "./layout";

const NODE_GEOMETRY = new THREE.SphereGeometry(1, 20, 20);

/** Sprite circolare: evita i punti quadrati di default. */
function makeDiscTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface SceneProps {
  graph: SystemGraph;
  selectedId: string | null;
  onSelect: (node: PositionedNode | null) => void;
  onHover: (node: PositionedNode | null) => void;
  autoRotate: boolean;
  visibleDomains: readonly string[];
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
        <sphereGeometry args={[0.75, 32, 32]} />
        <meshBasicMaterial color="#fff3cf" />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.16} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshBasicMaterial color="#7aa2ff" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={40} distance={40} color="#ffd88a" />
    </group>
  );
}

/** Polvere della galassia: nube di punti rotondi che segue i bracci visibili. */
function Dust({ discMap, visibleDomains }: { discMap: THREE.Texture; visibleDomains: readonly string[] }) {
  const geo = useMemo(() => {
    const arms = GALAXY_DOMAINS.filter((d) => visibleDomains.includes(d.id));
    const N = arms.length * 1400;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const domain = arms[i % Math.max(arms.length, 1)];
      const armIndex = GALAXY_DOMAINS.findIndex((d) => d.id === domain?.id);
      const base = (armIndex / GALAXY_DOMAINS.length) * Math.PI * 2;
      const t = Math.pow(Math.random(), 0.65);
      const r = 2.5 + t * 17;
      const a = base + t * 1.15 + (Math.random() - 0.5) * 0.55;
      pos[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * 1.2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * (0.8 + t * 2.4);
      pos[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 1.2;
      c.set(`hsl(${(domain?.hsl ?? "0 0% 80%").replace(/ /g, ", ")})`).lerp(new THREE.Color("#0b1030"), 0.45);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [visibleDomains]);

  return (
    <points geometry={geo}>
      <pointsMaterial
        size={0.075}
        map={discMap}
        alphaMap={discMap}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
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
        <lineBasicMaterial vertexColors transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
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
  const hitRef = useRef<THREE.InstancedMesh>(null);
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
      const pulse = isSel ? 1.9 + Math.sin(t * 1.4) * 0.2 : isHover ? 1.6 : 1;
      const s = (0.042 + n.weight * 0.032) * pulse;
      dummy.position.copy(n.position);
      dummy.position.y += Math.sin(t * 0.18 + n.position.x) * 0.02;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (hitRef.current) {
        dummy.scale.setScalar(Math.max(s * 3.2, 0.16));
        dummy.updateMatrix();
        hitRef.current.setMatrixAt(i, dummy.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (hitRef.current) hitRef.current.instanceMatrix.needsUpdate = true;
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
    <>
      <instancedMesh ref={meshRef} args={[NODE_GEOMETRY, undefined, paintable.length]} raycast={() => null}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      {/* Sfere invisibili più grandi: rendono i nodi facili da toccare */}
      <instancedMesh
        ref={hitRef}
        args={[NODE_GEOMETRY, undefined, paintable.length]}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) onSelect(paintable[e.instanceId]);
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

function Rotator({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current && enabled) ref.current.rotation.y += delta * 0.012;
  });
  return <group ref={ref}>{children}</group>;
}

export function GalaxyScene({ graph, selectedId, onSelect, onHover, autoRotate, visibleDomains }: SceneProps) {
  const discMap = useMemo(() => makeDiscTexture(), []);

  const filteredGraph = useMemo<SystemGraph>(() => {
    const keep = new Set(visibleDomains);
    const nodes = graph.nodes.filter((n) => n.kind === "core" || keep.has(n.domain));
    const ids = new Set(nodes.map((n) => n.id));
    const links = graph.links.filter((l) => ids.has(l.from) && ids.has(l.to));
    return { ...graph, nodes, links };
  }, [graph, visibleDomains]);

  const { nodes, byId } = useMemo(() => layoutGraph(filteredGraph), [filteredGraph]);

  return (
    <Canvas
      camera={{ position: [0, 11, 30], fov: 52 }}
      dpr={[1.5, 3]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#04060f"]} />
      <fog attach="fog" args={["#04060f", 40, 82]} />
      <ambientLight intensity={0.35} />
      <Rotator enabled={autoRotate}>
        <Core />
        <Dust discMap={discMap} visibleDomains={visibleDomains} />
        <Links graph={filteredGraph} byId={byId} selectedId={selectedId} />
        <Nodes nodes={nodes} selectedId={selectedId} onSelect={onSelect} onHover={onHover} />
      </Rotator>
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={70}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.45}
        zoomSpeed={0.6}
      />
    </Canvas>
  );
}


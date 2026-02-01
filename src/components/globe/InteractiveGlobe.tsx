import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, Html } from "@react-three/drei";
import * as THREE from "three";

interface PartnerPoint {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  campaigns: number;
}

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Sample partner locations (based on our demo data)
const PARTNER_LOCATIONS: PartnerPoint[] = [
  { id: "1", name: "Global Freight Solutions Ltd", city: "London", country: "UK", lat: 51.5074, lng: -0.1278, campaigns: 24 },
  { id: "2", name: "Shanghai Express Logistics", city: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737, campaigns: 18 },
  { id: "3", name: "Rotterdam Port Services BV", city: "Rotterdam", country: "Netherlands", lat: 51.9244, lng: 4.4777, campaigns: 12 },
  { id: "4", name: "Dubai Cargo Hub LLC", city: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708, campaigns: 31 },
  { id: "5", name: "Sydney Freight Partners", city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093, campaigns: 9 },
  { id: "6", name: "Hamburg Shipping GmbH", city: "Hamburg", country: "Germany", lat: 53.5511, lng: 9.9937, campaigns: 15 },
  { id: "7", name: "Singapore Air Cargo Pte Ltd", city: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198, campaigns: 22 },
  { id: "8", name: "Milan Intermodal SpA", city: "Milan", country: "Italy", lat: 45.4642, lng: 9.19, campaigns: 8 },
  { id: "9", name: "Tokyo Logistics Corp", city: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, campaigns: 27 },
  { id: "10", name: "São Paulo Transporte Ltda", city: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333, campaigns: 11 },
];

function PartnerMarker({ point, onHover }: { point: PartnerPoint; onHover: (point: PartnerPoint | null) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLngToVector3(point.lat, point.lng, 1.02), [point]);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (ref.current) {
      const scale = hovered ? 1.5 : 1;
      ref.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <mesh
      ref={ref}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(point);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <sphereGeometry args={[0.025, 16, 16]} />
      <meshStandardMaterial
        color={hovered ? "#0ea5e9" : "#22d3ee"}
        emissive={hovered ? "#0ea5e9" : "#06b6d4"}
        emissiveIntensity={hovered ? 1 : 0.5}
      />
    </mesh>
  );
}

function Globe({ onHover }: { onHover: (point: PartnerPoint | null) => void }) {
  const globeRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.05;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.07;
    }
  });

  // Create gradient atmosphere
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
  }, []);

  return (
    <group>
      {/* Atmosphere glow */}
      <Sphere args={[1.15, 64, 64]} material={atmosphereMaterial} />

      {/* Earth */}
      <Sphere ref={globeRef} args={[1, 64, 64]}>
        <meshStandardMaterial
          color="#1e3a5f"
          roughness={0.8}
          metalness={0.1}
        />
      </Sphere>

      {/* Continents overlay (simplified) */}
      <Sphere args={[1.001, 64, 64]}>
        <meshStandardMaterial
          color="#2d5a87"
          transparent
          opacity={0.3}
          wireframe
        />
      </Sphere>

      {/* Partner markers */}
      {PARTNER_LOCATIONS.map((point) => (
        <PartnerMarker key={point.id} point={point} onHover={onHover} />
      ))}

      {/* Connection lines between partners */}
      <ConnectionLines />
    </group>
  );
}

function ConnectionLines() {
  const linesRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (linesRef.current) {
      linesRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  const connections = useMemo(() => {
    const lines: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];
    // Create some connections between partners
    const pairs = [
      [0, 1], [0, 2], [1, 6], [3, 6], [2, 5], [4, 6], [8, 1], [9, 0]
    ];
    pairs.forEach(([a, b]) => {
      const startPoint = PARTNER_LOCATIONS[a];
      const endPoint = PARTNER_LOCATIONS[b];
      lines.push({
        start: latLngToVector3(startPoint.lat, startPoint.lng, 1.02),
        end: latLngToVector3(endPoint.lat, endPoint.lng, 1.02),
      });
    });
    return lines;
  }, []);

  return (
    <group ref={linesRef}>
      {connections.map((connection, i) => (
        <ArcLine key={i} start={connection.start} end={connection.end} />
      ))}
    </group>
  );
}

function ArcLine({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const curve = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(1.3); // Arc height
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [start, end]);

  const points = useMemo(() => curve.getPoints(50), [curve]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#0ea5e9" opacity={0.3} transparent linewidth={1} />
    </line>
  );
}

interface InteractiveGlobeProps {
  onPartnerSelect?: (partner: PartnerPoint | null) => void;
}

export function InteractiveGlobe({ onPartnerSelect }: InteractiveGlobeProps) {
  const [hoveredPartner, setHoveredPartner] = useState<PartnerPoint | null>(null);

  const handleHover = (point: PartnerPoint | null) => {
    setHoveredPartner(point);
    onPartnerSelect?.(point);
  };

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 45 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0ea5e9" />
        
        <Globe onHover={handleHover} />
        
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={2}
          maxDistance={5}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>

      {/* Tooltip */}
      {hoveredPartner && (
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm border rounded-lg p-4 shadow-elevated animate-fade-in">
          <p className="font-semibold">{hoveredPartner.name}</p>
          <p className="text-sm text-muted-foreground">
            {hoveredPartner.city}, {hoveredPartner.country}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl font-bold text-primary">{hoveredPartner.campaigns}</span>
            <span className="text-sm text-muted-foreground">campaigns sent</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { PARTNER_LOCATIONS };
export type { PartnerPoint };

/**
 * ContactCard3D — 3D contact card using React Three Fiber for AI Arena.
 */
import * as React from "react";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, Html } from "@react-three/drei";
import { Badge } from "@/components/ui/badge";
import * as THREE from "three";

interface ContactData {
  company_name: string;
  contact_name: string | null;
  contact_position: string | null;
  country_code: string;
  country_name: string | null;
  city: string | null;
  email: string;
  partner_match: boolean;
  rating: number | null;
}

interface ContactCard3DProps {
  contact: ContactData;
  animState: "enter" | "idle" | "confirm" | "skip" | "blacklist";
}

const FLAG_MAP: Record<string, string> = {
  IT: "🇮🇹", DE: "🇩🇪", FR: "🇫🇷", ES: "🇪🇸", GB: "🇬🇧", US: "🇺🇸", NL: "🇳🇱",
  PT: "🇵🇹", BR: "🇧🇷", PL: "🇵🇱", RO: "🇷🇴", CN: "🇨🇳", JP: "🇯🇵", KR: "🇰🇷",
  IN: "🇮🇳", AU: "🇦🇺", CA: "🇨🇦", TR: "🇹🇷", RU: "🇷🇺", SE: "🇸🇪", NO: "🇳🇴",
  DK: "🇩🇰", FI: "🇫🇮", GR: "🇬🇷", AT: "🇦🇹", CH: "🇨🇭", BE: "🇧🇪",
  TH: "🇹🇭", VN: "🇻🇳", SA: "🇸🇦", AE: "🇦🇪", MX: "🇲🇽", AR: "🇦🇷",
};

function FloatingCard({ contact, animState }: ContactCard3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;

    if (animState === "enter") {
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, 0, delta * 4);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, delta * 3);
    } else if (animState === "idle") {
      meshRef.current.position.y = Math.sin(timeRef.current * 1.5) * 0.05;
      meshRef.current.rotation.y = Math.sin(timeRef.current * 0.8) * 0.03;
    } else if (animState === "confirm") {
      meshRef.current.position.x += delta * 8;
      meshRef.current.rotation.y += delta * 2;
    } else if (animState === "skip") {
      meshRef.current.position.y -= delta * 4;
      meshRef.current.scale.setScalar(Math.max(0.01, meshRef.current.scale.x - delta * 2));
    } else if (animState === "blacklist") {
      meshRef.current.position.x = Math.sin(timeRef.current * 30) * 0.15;
      meshRef.current.scale.setScalar(Math.max(0.01, meshRef.current.scale.x - delta * 3));
    }
  });

  const flag = FLAG_MAP[contact.country_code?.toUpperCase()] || "🌍";

  return (
    <mesh ref={meshRef} position={[-5, 0, 0]} rotation={[0, 0.8, 0]}>
      <RoundedBox args={[4, 2.5, 0.15]} radius={0.12} smoothness={4}>
        <meshStandardMaterial
          color="#1a1a2e"
          metalness={0.3}
          roughness={0.7}
          emissive="#1e3a5f"
          emissiveIntensity={0.1}
        />
      </RoundedBox>
      <Html center transform distanceFactor={3} style={{ pointerEvents: "none" }}>
        <div className="w-[320px] p-4 text-center select-none">
          <h2 className="text-lg font-bold text-white truncate">{contact.company_name}</h2>
          {contact.contact_name && (
            <p className="text-sm text-blue-300 mt-1">
              {contact.contact_name}
              {contact.contact_position && <span className="text-blue-400/70 ml-1">· {contact.contact_position}</span>}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {flag} {contact.city ? `${contact.city}, ` : ""}{contact.country_name || contact.country_code}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-mono">{contact.email}</p>
          <div className="mt-2 flex justify-center gap-2">
            {contact.partner_match ? (
              <Badge className="bg-green-500/20 text-green-300 border-0 text-[10px]">🤝 Partner WCA</Badge>
            ) : (
              <Badge className="bg-blue-500/20 text-blue-300 border-0 text-[10px]">🆕 Nuovo</Badge>
            )}
            {contact.rating && (
              <Badge className="bg-yellow-500/20 text-yellow-300 border-0 text-[10px]">⭐ {contact.rating}</Badge>
            )}
          </div>
        </div>
      </Html>
    </mesh>
  );
}

export function ContactCard3D({ contact, animState }: ContactCard3DProps): React.ReactElement {
  return (
    <div className="w-full h-[300px]">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={0.8} color="#4d94ff" />
        <pointLight position={[-5, -2, 3]} intensity={0.4} color="#8b5cf6" />
        <FloatingCard contact={contact} animState={animState} />
      </Canvas>
    </div>
  );
}

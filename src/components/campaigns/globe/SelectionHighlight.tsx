import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latLngToVector3, easeOutQuart, easeInOutSine } from "./utils";

// Only two elements: center dot and one pulse ring
const DOT_GEOMETRY = new THREE.CircleGeometry(0.008, 16);
const RING_GEOMETRY = new THREE.RingGeometry(0.04, 0.045, 64);

interface Props {
  lat: number;
  lng: number;
  isVisible: boolean;
}

export function SelectionHighlight({ lat, lng, isVisible }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(0);
  const entryTimeRef = useRef(0);
  
  const position = useMemo(() => latLngToVector3(lat, lng, 1.006), [lat, lng]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Track entry time for intro animation
    if (isVisible && opacityRef.current < 0.1) {
      entryTimeRef.current = time;
    }
    
    // Smooth opacity transition
    const targetOpacity = isVisible ? 1 : 0;
    const opacityDiff = targetOpacity - opacityRef.current;
    opacityRef.current += opacityDiff * (isVisible ? 0.08 : 0.15);
    
    if (opacityRef.current < 0.01) return;

    if (groupRef.current) {
      groupRef.current.lookAt(0, 0, 0);
    }

    const opacity = opacityRef.current;
    const timeSinceEntry = time - entryTimeRef.current;
    const introProgress = Math.min(timeSinceEntry / 0.8, 1);
    const introEased = easeOutQuart(introProgress);
    
    // Center dot - slow pulsing
    if (dotRef.current) {
      const dotPulse = easeInOutSine((time * 0.167) % 1);
      const dotScale = 1 + dotPulse * 0.4;
      const dotOpacity = 0.7 + dotPulse * 0.3;
      dotRef.current.scale.setScalar(dotScale);
      (dotRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * dotOpacity;
    }
    
    // Single pulse ring - expanding wave
    if (ringRef.current) {
      const pulsePhase = (time * 0.2) % 1;
      const pulseScale = introEased * (1 + pulsePhase * 2);
      const pulseOpacity = opacity * (1 - pulsePhase) * 0.8;
      ringRef.current.scale.setScalar(pulseScale);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = pulseOpacity;
    }
  });

  if (!isVisible && opacityRef.current < 0.01) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Center pulsing dot */}
      <mesh ref={dotRef} geometry={DOT_GEOMETRY}>
        <meshBasicMaterial color="#fef3c7" transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Single expanding pulse ring */}
      <mesh ref={ringRef} geometry={RING_GEOMETRY}>
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

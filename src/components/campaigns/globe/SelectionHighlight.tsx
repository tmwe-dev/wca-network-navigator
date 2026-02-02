import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Elegant ring geometries with finer detail
const RING_GEOMETRY_INNER = new THREE.RingGeometry(0.04, 0.05, 64);
const RING_GEOMETRY_MIDDLE = new THREE.RingGeometry(0.07, 0.075, 64);
const RING_GEOMETRY_OUTER = new THREE.RingGeometry(0.11, 0.115, 64);
const RING_GEOMETRY_PULSE = new THREE.RingGeometry(0.13, 0.135, 64);

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Smooth easing function
function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

interface Props {
  lat: number;
  lng: number;
  isVisible: boolean;
}

export function SelectionHighlight({ lat, lng, isVisible }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const middleRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(0);
  const entryTimeRef = useRef(0);
  
  const position = useMemo(() => latLngToVector3(lat, lng, 1.006), [lat, lng]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Track entry time for intro animation
    if (isVisible && opacityRef.current < 0.1) {
      entryTimeRef.current = time;
    }
    
    // Smooth opacity transition with easing
    const targetOpacity = isVisible ? 1 : 0;
    const opacityDiff = targetOpacity - opacityRef.current;
    opacityRef.current += opacityDiff * (isVisible ? 0.08 : 0.15);
    
    if (opacityRef.current < 0.01) return;

    if (groupRef.current) {
      groupRef.current.lookAt(0, 0, 0);
    }

    const opacity = opacityRef.current;
    const timeSinceEntry = time - entryTimeRef.current;
    const introProgress = Math.min(timeSinceEntry / 0.8, 1); // 0.8s intro
    const introEased = easeOutQuart(introProgress);
    
    // Inner ring - subtle breathing with delayed start
    if (innerRef.current) {
      const breath = easeInOutSine((time * 1.5) % 1) * 0.15 + 1;
      const scale = introEased * breath;
      innerRef.current.scale.setScalar(scale);
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.95;
    }
    
    // Middle ring - counter-rotate with phase offset
    if (middleRef.current) {
      const breath = easeInOutSine((time * 1.2 + 0.3) % 1) * 0.1 + 1;
      const scale = introEased * breath * 1.1;
      middleRef.current.scale.setScalar(scale);
      middleRef.current.rotation.z = time * 0.3; // Slow rotation
      (middleRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.7;
    }
    
    // Outer ring - slow expansion
    if (outerRef.current) {
      const breath = easeInOutSine((time * 0.8 + 0.6) % 1) * 0.08 + 1;
      const scale = introEased * breath * 1.15;
      outerRef.current.scale.setScalar(scale);
      outerRef.current.rotation.z = -time * 0.2; // Counter rotation
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5;
    }
    
    // Pulse ring - continuous expanding wave
    if (pulseRef.current) {
      const pulsePhase = (time * 0.6) % 1;
      const pulseScale = introEased * (1 + pulsePhase * 1.5);
      const pulseOpacity = opacity * (1 - pulsePhase) * 0.6;
      pulseRef.current.scale.setScalar(pulseScale);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = pulseOpacity;
    }
  });

  if (!isVisible && opacityRef.current < 0.01) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Inner glow ring */}
      <mesh ref={innerRef} geometry={RING_GEOMETRY_INNER}>
        <meshBasicMaterial color="#fef3c7" transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Middle rotating ring */}
      <mesh ref={middleRef} geometry={RING_GEOMETRY_MIDDLE}>
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Outer rotating ring */}
      <mesh ref={outerRef} geometry={RING_GEOMETRY_OUTER}>
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Expanding pulse ring */}
      <mesh ref={pulseRef} geometry={RING_GEOMETRY_PULSE}>
        <meshBasicMaterial color="#fcd34d" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Inner rings - thinner and blue
const RING_GEOMETRY_INNER_1 = new THREE.RingGeometry(0.03, 0.035, 32);
const RING_GEOMETRY_INNER_2 = new THREE.RingGeometry(0.05, 0.055, 32);
// Outer rings - thin and red
const RING_GEOMETRY_OUTER_1 = new THREE.RingGeometry(0.08, 0.085, 32);
const RING_GEOMETRY_OUTER_2 = new THREE.RingGeometry(0.11, 0.115, 32);
const RING_GEOMETRY_OUTER_3 = new THREE.RingGeometry(0.14, 0.145, 32);

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

interface Props {
  lat: number;
  lng: number;
  isVisible: boolean;
}

export function SelectionHighlight({ lat, lng, isVisible }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRing1Ref = useRef<THREE.Mesh>(null);
  const innerRing2Ref = useRef<THREE.Mesh>(null);
  const outerRing1Ref = useRef<THREE.Mesh>(null);
  const outerRing2Ref = useRef<THREE.Mesh>(null);
  const outerRing3Ref = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(0);
  
  const position = useMemo(() => latLngToVector3(lat, lng, 1.005), [lat, lng]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Smooth opacity transition
    const targetOpacity = isVisible ? 1 : 0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, 0.1);
    
    if (opacityRef.current < 0.01) return;

    if (groupRef.current) {
      groupRef.current.lookAt(0, 0, 0);
    }

    const opacity = opacityRef.current;

    // Inner rings - subtle pulse
    if (innerRing1Ref.current) {
      const scale1 = 1 + Math.sin(time * 3) * 0.05;
      innerRing1Ref.current.scale.setScalar(scale1);
      (innerRing1Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.3;
    }
    if (innerRing2Ref.current) {
      const scale2 = 1 + Math.sin(time * 3 + 0.5) * 0.05;
      innerRing2Ref.current.scale.setScalar(scale2);
      (innerRing2Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.2;
    }

    // Outer rings - wave effect expanding outward
    if (outerRing1Ref.current) {
      const phase1 = (time * 0.8) % 1;
      const scale1 = 1 + phase1 * 0.5;
      outerRing1Ref.current.scale.setScalar(scale1);
      (outerRing1Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * (1 - phase1) * 0.7;
    }
    if (outerRing2Ref.current) {
      const phase2 = ((time * 0.8) + 0.33) % 1;
      const scale2 = 1 + phase2 * 0.5;
      outerRing2Ref.current.scale.setScalar(scale2);
      (outerRing2Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * (1 - phase2) * 0.6;
    }
    if (outerRing3Ref.current) {
      const phase3 = ((time * 0.8) + 0.66) % 1;
      const scale3 = 1 + phase3 * 0.5;
      outerRing3Ref.current.scale.setScalar(scale3);
      (outerRing3Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * (1 - phase3) * 0.5;
    }
  });

  if (!isVisible && opacityRef.current < 0.01) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Inner rings - transparent blue */}
      <mesh ref={innerRing1Ref} geometry={RING_GEOMETRY_INNER_1}>
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={innerRing2Ref} geometry={RING_GEOMETRY_INNER_2}>
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Outer rings - thin red wave effect */}
      <mesh ref={outerRing1Ref} geometry={RING_GEOMETRY_OUTER_1}>
        <meshBasicMaterial color="#ef4444" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={outerRing2Ref} geometry={RING_GEOMETRY_OUTER_2}>
        <meshBasicMaterial color="#dc2626" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={outerRing3Ref} geometry={RING_GEOMETRY_OUTER_3}>
        <meshBasicMaterial color="#b91c1c" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

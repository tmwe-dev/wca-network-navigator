import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Shared geometries
const RING_GEOMETRY_1 = new THREE.RingGeometry(0.08, 0.1, 32);
const RING_GEOMETRY_2 = new THREE.RingGeometry(0.1, 0.15, 32);
const RING_GEOMETRY_3 = new THREE.RingGeometry(0.12, 0.13, 32);

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
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
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

    if (ring1Ref.current) {
      const scale1 = 1 + Math.sin(time * 2) * 0.1;
      ring1Ref.current.scale.setScalar(scale1);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8;
    }
    if (ring2Ref.current) {
      const scale2 = 1.3 + Math.sin(time * 2 + 1) * 0.1;
      ring2Ref.current.scale.setScalar(scale2);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5;
    }
    if (ring3Ref.current) {
      const scale3 = ((time * 0.5) % 1) * 2 + 1;
      ring3Ref.current.scale.setScalar(scale3);
      (ring3Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * (1 - ((time * 0.5) % 1));
    }
  });

  if (!isVisible && opacityRef.current < 0.01) return null;

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={ring1Ref} geometry={RING_GEOMETRY_1}>
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} geometry={RING_GEOMETRY_2}>
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring3Ref} geometry={RING_GEOMETRY_3}>
        <meshBasicMaterial color="#fcd34d" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

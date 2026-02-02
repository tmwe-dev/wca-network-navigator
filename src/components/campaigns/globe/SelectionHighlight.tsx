import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Small dot geometry (4 pixels equivalent at globe scale)
const DOT_GEOMETRY = new THREE.CircleGeometry(0.008, 16);

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
  const dotRef = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(0);
  
  const position = useMemo(() => latLngToVector3(lat, lng, 1.006), [lat, lng]);

  useFrame(() => {
    // Smooth opacity transition
    const targetOpacity = isVisible ? 1 : 0;
    const opacityDiff = targetOpacity - opacityRef.current;
    opacityRef.current += opacityDiff * (isVisible ? 0.1 : 0.2);
    
    if (opacityRef.current < 0.01) return;

    if (groupRef.current) {
      groupRef.current.lookAt(0, 0, 0);
    }

    if (dotRef.current) {
      (dotRef.current.material as THREE.MeshBasicMaterial).opacity = opacityRef.current;
    }
  });

  if (!isVisible && opacityRef.current < 0.01) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Simple small dot */}
      <mesh ref={dotRef} geometry={DOT_GEOMETRY}>
        <meshBasicMaterial color="#fbbf24" transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

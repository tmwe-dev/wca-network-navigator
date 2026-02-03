import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GlobePartner } from "../../types";
import { latLngToVector3 } from "../../utils";

const CITY_GEOMETRY = new THREE.SphereGeometry(0.012, 6, 6);
const CITY_MATERIAL = new THREE.MeshBasicMaterial({ color: "#fef3c7" });

interface Props {
  partners: GlobePartner[];
  isVisible: boolean;
}

export function CityMarkers({ partners, isVisible }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const scalesRef = useRef<Float32Array>(new Float32Array(partners.length));
  const startTimeRef = useRef<number>(0);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  
  const positions = useMemo(() => 
    partners.map(p => latLngToVector3(p.lat, p.lng, 1.025)),
    [partners]
  );

  // Reset animation when visibility changes
  useEffect(() => {
    if (isVisible) {
      startTimeRef.current = 0;
    }
  }, [isVisible]);

  useFrame((state) => {
    if (!meshRef.current || partners.length === 0) return;
    
    const time = state.clock.elapsedTime;
    
    if (isVisible && startTimeRef.current === 0) {
      startTimeRef.current = time;
    }
    
    const elapsedSinceVisible = time - startTimeRef.current;
    
    for (let i = 0; i < partners.length; i++) {
      const delay = i * 0.1;
      let targetScale = 0;
      
      if (isVisible && elapsedSinceVisible > delay) {
        targetScale = 1;
        // Add pulse effect
        const pulse = Math.sin(time * 3 + delay * 10) * 0.1 + 1;
        targetScale *= pulse;
      }
      
      // Smooth scale transition
      scalesRef.current[i] = THREE.MathUtils.lerp(
        scalesRef.current[i] || 0,
        targetScale,
        isVisible ? 0.15 : 0.2
      );
      
      const scale = scalesRef.current[i];
      const pos = positions[i];
      
      tempMatrix.makeTranslation(pos.x, pos.y, pos.z);
      tempMatrix.scale(new THREE.Vector3(scale, scale, scale));
      meshRef.current.setMatrixAt(i, tempMatrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (partners.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[CITY_GEOMETRY, CITY_MATERIAL, partners.length]}
    />
  );
}

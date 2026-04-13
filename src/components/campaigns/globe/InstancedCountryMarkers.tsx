import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { type CountryWithPartners } from "@/hooks/usePartnersForGlobe";
import { latLngToVector3 } from "./utils";

// Smaller marker geometries
const INNER_GEOMETRY = new THREE.SphereGeometry(0.012, 6, 6);
const OUTER_GEOMETRY = new THREE.SphereGeometry(0.018, 6, 6);

// Colors
const COLOR_PARTNER = new THREE.Color("#f59e0b");
const COLOR_PARTNER_GLOW = new THREE.Color("#fcd34d");
const COLOR_PARTNER_SELECTED = new THREE.Color("#fbbf24");
const COLOR_PARTNER_SELECTED_GLOW = new THREE.Color("#fef3c7");
const COLOR_NO_PARTNER = new THREE.Color("#6b7280");
const COLOR_NO_PARTNER_GLOW = new THREE.Color("#9ca3af");

interface Props {
  countries: CountryWithPartners[];
  selectedCountry: string | null;
  onSelect: (code: string) => void;
}

export function InstancedCountryMarkers({ countries, selectedCountry, onSelect }: Props) {
  const innerRef = useRef<THREE.InstancedMesh>(null);
  const outerRef = useRef<THREE.InstancedMesh>(null);
  const { raycaster, camera, pointer } = useThree();
  
  const hoveredRef = useRef<number | null>(null);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const _tempColor = useMemo(() => new THREE.Color(), []);
  const tempPosition = useMemo(() => new THREE.Vector3(), []);
  
  // Pre-compute positions once
  const positions = useMemo(() => 
    countries.map(c => latLngToVector3(c.lat, c.lng, 1.01)),
    [countries]
  );

  // Initialize instance matrices
  useEffect(() => {
    if (!innerRef.current || !outerRef.current) return;
    
    positions.forEach((pos, i) => {
      tempMatrix.makeTranslation(pos.x, pos.y, pos.z);
      innerRef.current!.setMatrixAt(i, tempMatrix);
      outerRef.current!.setMatrixAt(i, tempMatrix);
      
      // Set initial colors
      const country = countries[i];
      const hasPartners = country.count > 0;
      innerRef.current!.setColorAt(i, hasPartners ? COLOR_PARTNER_GLOW : COLOR_NO_PARTNER_GLOW);
      outerRef.current!.setColorAt(i, hasPartners ? COLOR_PARTNER : COLOR_NO_PARTNER);
    });
    
    innerRef.current.instanceMatrix.needsUpdate = true;
    outerRef.current.instanceMatrix.needsUpdate = true;
    if (innerRef.current.instanceColor) innerRef.current.instanceColor.needsUpdate = true;
    if (outerRef.current.instanceColor) outerRef.current.instanceColor.needsUpdate = true;
  }, [positions, countries, tempMatrix]);

  // Single useFrame for all animations
  useFrame((state) => {
    if (!innerRef.current || !outerRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Raycast for hover detection (throttled)
    if (Math.floor(time * 10) % 2 === 0) {
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(innerRef.current);
      hoveredRef.current = intersects.length > 0 ? intersects[0].instanceId ?? null : null;
    }
    
    // Update all instances in one loop
    for (let i = 0; i < countries.length; i++) {
      const country = countries[i];
      const hasPartners = country.count > 0;
      const isSelected = selectedCountry === country.code;
      const isHovered = hoveredRef.current === i;
      const hasSelection = selectedCountry !== null;
      
      // Calculate scale based on state - hide ALL markers when a country is selected
      let innerScale: number;
      let outerScale: number;
      
      if (hasSelection) {
        // Hide ALL markers when any country is selected (SelectionHighlight handles the target)
        innerScale = 0;
        outerScale = 0;
      } else if (isHovered) {
        innerScale = (Math.sin(time * 3) * 0.15 + 1.2) * (hasPartners ? 1 : 0.5);
        outerScale = 2;
      } else {
        const breathe = Math.sin(time * 2 + country.lat) * 0.08 + 1;
        innerScale = breathe * (hasPartners ? 1 : 0.5);
        outerScale = (Math.sin(time * 2 + country.lat) * 0.15 + 0.7) * 1.8;
      }
      
      // Update inner mesh
      tempPosition.copy(positions[i]);
      tempMatrix.makeTranslation(tempPosition.x, tempPosition.y, tempPosition.z);
      tempMatrix.scale(new THREE.Vector3(innerScale, innerScale, innerScale));
      innerRef.current.setMatrixAt(i, tempMatrix);
      
      // Update outer mesh
      tempMatrix.makeTranslation(tempPosition.x, tempPosition.y, tempPosition.z);
      tempMatrix.scale(new THREE.Vector3(outerScale, outerScale, outerScale));
      outerRef.current.setMatrixAt(i, tempMatrix);
      
      // Update colors for selected state
      if (isSelected) {
        innerRef.current.setColorAt(i, hasPartners ? COLOR_PARTNER_SELECTED_GLOW : COLOR_NO_PARTNER_GLOW);
        outerRef.current.setColorAt(i, hasPartners ? COLOR_PARTNER_SELECTED : COLOR_NO_PARTNER);
      } else {
        innerRef.current.setColorAt(i, hasPartners ? COLOR_PARTNER_GLOW : COLOR_NO_PARTNER_GLOW);
        outerRef.current.setColorAt(i, hasPartners ? COLOR_PARTNER : COLOR_NO_PARTNER);
      }
    }
    
    innerRef.current.instanceMatrix.needsUpdate = true;
    outerRef.current.instanceMatrix.needsUpdate = true;
    if (innerRef.current.instanceColor) innerRef.current.instanceColor.needsUpdate = true;
    if (outerRef.current.instanceColor) outerRef.current.instanceColor.needsUpdate = true;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && countries[e.instanceId]) {
      onSelect(countries[e.instanceId].code);
    }
  };

  const handlePointerOver = () => {
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
    hoveredRef.current = null;
  };

  return (
    <>
      <instancedMesh
        ref={innerRef}
        args={[INNER_GEOMETRY, undefined, countries.length]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh
        ref={outerRef}
        args={[OUTER_GEOMETRY, undefined, countries.length]}
      >
        <meshBasicMaterial transparent opacity={0.4} />
      </instancedMesh>
    </>
  );
}

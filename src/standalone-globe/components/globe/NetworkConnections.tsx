import { useMemo } from "react";
import * as THREE from "three";
import { CountryWithPartners } from "../../types";
import { latLngToVector3 } from "../../utils";

const CONNECTION_PAIRS = [
  ["GB", "US"], ["GB", "DE"], ["DE", "CN"], ["CN", "JP"], 
  ["US", "BR"], ["FR", "IT"], ["SG", "AU"], ["AE", "IN"],
  ["NL", "DE"], ["JP", "KR"], ["ES", "BR"], ["FR", "CN"],
];

// Shared material
const LINE_MATERIAL = new THREE.LineBasicMaterial({ 
  color: "#60a5fa", 
  transparent: true, 
  opacity: 0.35 
});

interface Props {
  countries: CountryWithPartners[];
}

export function NetworkConnections({ countries }: Props) {
  // Create a single merged geometry for all connections
  const linesObject = useMemo(() => {
    const group = new THREE.Group();
    const countriesMap = new Map(countries.map(c => [c.code, c]));
    
    CONNECTION_PAIRS.forEach(([a, b]) => {
      const countryA = countriesMap.get(a);
      const countryB = countriesMap.get(b);
      
      if (countryA && countryB) {
        const start = latLngToVector3(countryA.lat, countryA.lng, 1.01);
        const end = latLngToVector3(countryB.lat, countryB.lng, 1.01);
        
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const distance = start.distanceTo(end);
        mid.normalize().multiplyScalar(1 + distance * 0.15);
        
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(30);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, LINE_MATERIAL);
        group.add(line);
      }
    });
    
    return group;
  }, [countries]);

  return <primitive object={linesObject} />;
}

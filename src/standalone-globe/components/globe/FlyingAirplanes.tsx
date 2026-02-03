import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CountryWithPartners } from "../../types";
import { latLngToVector3 } from "../../utils";

// Create a smooth arc between two points on a sphere
function createArcPoints(start: THREE.Vector3, end: THREE.Vector3, arcHeight: number, segments: number = 50): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Spherical interpolation for the base path
    const point = new THREE.Vector3().lerpVectors(start, end, t);
    point.normalize();
    
    // Add arc height using sine curve (peaks at middle)
    const arcFactor = Math.sin(t * Math.PI) * arcHeight;
    point.multiplyScalar(1.02 + arcFactor);
    
    points.push(point);
  }
  
  return points;
}

interface FlightRoute {
  id: number;
  startCity: CountryWithPartners;
  endCity: CountryWithPartners;
  startTime: number;
  duration: number;
  arcPoints: THREE.Vector3[];
}

interface Props {
  countries: CountryWithPartners[];
  isActive: boolean; // Only animate when globe is "free"
}

export function FlyingAirplanes({ countries, isActive }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const routesRef = useRef<FlightRoute[]>([]);
  const lastRouteTimeRef = useRef<number>(0);
  const airplaneRefs = useRef<THREE.Mesh[]>([]);
  const trailRefs = useRef<THREE.Line[]>([]);
  
  // Get countries with partners for realistic routes
  const countriesWithPartners = useMemo(() => 
    countries.filter(c => c.count > 0),
    [countries]
  );

  // Generate a new random flight route
  const generateRoute = (time: number): FlightRoute | null => {
    if (countriesWithPartners.length < 2) return null;
    
    // Pick two random different cities
    const idx1 = Math.floor(Math.random() * countriesWithPartners.length);
    let idx2 = Math.floor(Math.random() * countriesWithPartners.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * countriesWithPartners.length);
    }
    
    const startCity = countriesWithPartners[idx1];
    const endCity = countriesWithPartners[idx2];
    
    const startPos = latLngToVector3(startCity.lat, startCity.lng, 1.02);
    const endPos = latLngToVector3(endCity.lat, endCity.lng, 1.02);
    
    // Calculate arc height based on distance
    const distance = startPos.distanceTo(endPos);
    const arcHeight = Math.min(distance * 0.15, 0.25);
    
    return {
      id: Date.now() + Math.random(),
      startCity,
      endCity,
      startTime: time,
      duration: 4 + Math.random() * 2, // 4-6 seconds flight
      arcPoints: createArcPoints(startPos, endPos, arcHeight),
    };
  };

  // Create airplane geometry (simple triangle)
  const airplaneGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.012);
    shape.lineTo(-0.005, -0.006);
    shape.lineTo(0, -0.003);
    shape.lineTo(0.005, -0.006);
    shape.closePath();
    
    return new THREE.ShapeGeometry(shape);
  }, []);

  useFrame((state) => {
    if (!groupRef.current || !isActive) return;
    
    const time = state.clock.elapsedTime;
    
    // Generate new routes every ~3.5 seconds (staggered with 2-3 planes)
    if (time - lastRouteTimeRef.current > 3.5 && routesRef.current.length < 3) {
      const newRoute = generateRoute(time);
      if (newRoute) {
        routesRef.current.push(newRoute);
      }
      lastRouteTimeRef.current = time;
    }
    
    // Clean up completed routes
    routesRef.current = routesRef.current.filter(route => {
      const elapsed = time - route.startTime;
      return elapsed < route.duration + 0.5;
    });
    
    // Update airplane positions
    routesRef.current.forEach((route, index) => {
      const elapsed = time - route.startTime;
      const progress = Math.min(elapsed / route.duration, 1);
      
      // Easing function for smooth acceleration/deceleration
      const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      
      // Get position along arc
      const arcIndex = Math.floor(easedProgress * (route.arcPoints.length - 1));
      const nextIndex = Math.min(arcIndex + 1, route.arcPoints.length - 1);
      const localT = (easedProgress * (route.arcPoints.length - 1)) % 1;
      
      const position = new THREE.Vector3().lerpVectors(
        route.arcPoints[arcIndex],
        route.arcPoints[nextIndex],
        localT
      );
      
      // Get airplane mesh or create if needed
      let airplane = airplaneRefs.current[index];
      if (!airplane) {
        airplane = new THREE.Mesh(
          airplaneGeometry,
          new THREE.MeshBasicMaterial({ 
            color: 0xfbbf24, 
            transparent: true,
            side: THREE.DoubleSide,
          })
        );
        groupRef.current!.add(airplane);
        airplaneRefs.current[index] = airplane;
      }
      
      // Position and orient airplane
      airplane.position.copy(position);
      airplane.lookAt(0, 0, 0);
      
      // Calculate direction for rotation
      if (nextIndex > arcIndex) {
        const direction = new THREE.Vector3().subVectors(
          route.arcPoints[nextIndex],
          route.arcPoints[arcIndex]
        ).normalize();
        
        // Create quaternion to orient airplane along path
        const up = position.clone().normalize();
        const forward = direction.clone();
        const right = new THREE.Vector3().crossVectors(up, forward).normalize();
        forward.crossVectors(right, up).normalize();
        
        const matrix = new THREE.Matrix4().makeBasis(right, up, forward.negate());
        airplane.quaternion.setFromRotationMatrix(matrix);
      }
      
      // Fade in/out
      const fadeIn = Math.min(progress * 5, 1);
      const fadeOut = Math.min((1 - progress) * 5, 1);
      (airplane.material as THREE.MeshBasicMaterial).opacity = fadeIn * fadeOut * 0.9;
      
      airplane.visible = true;
    });
    
    // Hide unused airplanes
    for (let i = routesRef.current.length; i < airplaneRefs.current.length; i++) {
      if (airplaneRefs.current[i]) {
        airplaneRefs.current[i].visible = false;
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      airplaneRefs.current.forEach(mesh => {
        if (mesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
    };
  }, []);

  if (!isActive) return null;

  return <group ref={groupRef} />;
}

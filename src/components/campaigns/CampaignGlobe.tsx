import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sphere, Stars } from "@react-three/drei";
import * as THREE from "three";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getCountryFlag } from "@/lib/countries";
import { Building2, Mail, MapPin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mock partner data with coordinates
export interface MockPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  partner_type: string;
  lat: number;
  lng: number;
  certifications: string[];
  services: string[];
}

export const MOCK_PARTNERS: MockPartner[] = [
  { id: "1", company_name: "Global Freight Solutions Ltd", city: "London", country_code: "GB", country_name: "United Kingdom", email: "info@gfs.co.uk", partner_type: "freight_forwarder", lat: 51.5074, lng: -0.1278, certifications: ["IATA", "AEO"], services: ["air_freight", "ocean_fcl"] },
  { id: "2", company_name: "British Cargo Express", city: "Manchester", country_code: "GB", country_name: "United Kingdom", email: "ops@bce.co.uk", partner_type: "freight_forwarder", lat: 53.4808, lng: -2.2426, certifications: ["ISO"], services: ["road_freight", "warehousing"] },
  { id: "3", company_name: "London Logistics Partners", city: "London", country_code: "GB", country_name: "United Kingdom", email: "hello@llp.co.uk", partner_type: "3pl", lat: 51.5074, lng: -0.1278, certifications: ["IATA", "ISO"], services: ["air_freight", "pharma"] },
  { id: "4", company_name: "Shanghai Express Logistics", city: "Shanghai", country_code: "CN", country_name: "China", email: "contact@sel.cn", partner_type: "freight_forwarder", lat: 31.2304, lng: 121.4737, certifications: ["IATA", "BASC"], services: ["air_freight", "ocean_fcl", "pharma"] },
  { id: "5", company_name: "Beijing Cargo Services", city: "Beijing", country_code: "CN", country_name: "China", email: "info@bcs.cn", partner_type: "carrier", lat: 39.9042, lng: 116.4074, certifications: ["ISO"], services: ["air_freight", "dangerous_goods"] },
  { id: "6", company_name: "Guangzhou Shipping Co", city: "Guangzhou", country_code: "CN", country_name: "China", email: "ship@gzsc.cn", partner_type: "nvocc", lat: 23.1291, lng: 113.2644, certifications: ["IATA"], services: ["ocean_fcl", "ocean_lcl"] },
  { id: "7", company_name: "Rotterdam Port Services BV", city: "Rotterdam", country_code: "NL", country_name: "Netherlands", email: "ops@rps.nl", partner_type: "freight_forwarder", lat: 51.9244, lng: 4.4777, certifications: ["AEO", "ISO"], services: ["ocean_fcl", "warehousing"] },
  { id: "8", company_name: "Amsterdam Freight BV", city: "Amsterdam", country_code: "NL", country_name: "Netherlands", email: "info@afbv.nl", partner_type: "customs_broker", lat: 52.3676, lng: 4.9041, certifications: ["AEO"], services: ["customs_broker", "pharma"] },
  { id: "9", company_name: "Dubai Cargo Hub LLC", city: "Dubai", country_code: "AE", country_name: "UAE", email: "cargo@dch.ae", partner_type: "freight_forwarder", lat: 25.2048, lng: 55.2708, certifications: ["IATA", "BASC"], services: ["air_freight", "dangerous_goods", "pharma"] },
  { id: "10", company_name: "Abu Dhabi Logistics", city: "Abu Dhabi", country_code: "AE", country_name: "UAE", email: "ops@adl.ae", partner_type: "3pl", lat: 24.4539, lng: 54.3773, certifications: ["ISO"], services: ["warehousing", "ecommerce"] },
  { id: "11", company_name: "Sydney Freight Partners", city: "Sydney", country_code: "AU", country_name: "Australia", email: "hello@sfp.com.au", partner_type: "freight_forwarder", lat: -33.8688, lng: 151.2093, certifications: ["IATA"], services: ["air_freight", "ocean_fcl"] },
  { id: "12", company_name: "Melbourne Cargo Co", city: "Melbourne", country_code: "AU", country_name: "Australia", email: "info@mcc.com.au", partner_type: "carrier", lat: -37.8136, lng: 144.9631, certifications: ["ISO"], services: ["road_freight", "perishables"] },
  { id: "13", company_name: "Hamburg Shipping GmbH", city: "Hamburg", country_code: "DE", country_name: "Germany", email: "kontakt@hsg.de", partner_type: "freight_forwarder", lat: 53.5511, lng: 9.9937, certifications: ["AEO", "ISO", "IATA"], services: ["ocean_fcl", "rail_freight", "pharma"] },
  { id: "14", company_name: "Frankfurt Logistics AG", city: "Frankfurt", country_code: "DE", country_name: "Germany", email: "info@flag.de", partner_type: "3pl", lat: 50.1109, lng: 8.6821, certifications: ["AEO"], services: ["air_freight", "warehousing"] },
  { id: "15", company_name: "Munich Transport GmbH", city: "Munich", country_code: "DE", country_name: "Germany", email: "ops@mtg.de", partner_type: "carrier", lat: 48.1351, lng: 11.582, certifications: ["ISO"], services: ["road_freight", "project_cargo"] },
  { id: "16", company_name: "Singapore Air Cargo Pte Ltd", city: "Singapore", country_code: "SG", country_name: "Singapore", email: "cargo@sac.sg", partner_type: "freight_forwarder", lat: 1.3521, lng: 103.8198, certifications: ["IATA", "C-TPAT"], services: ["air_freight", "pharma", "dangerous_goods"] },
  { id: "17", company_name: "Milan Intermodal SpA", city: "Milan", country_code: "IT", country_name: "Italy", email: "info@mis.it", partner_type: "freight_forwarder", lat: 45.4642, lng: 9.19, certifications: ["IATA", "ISO"], services: ["air_freight", "rail_freight"] },
  { id: "18", company_name: "Rome Cargo Services", city: "Rome", country_code: "IT", country_name: "Italy", email: "ops@rcs.it", partner_type: "customs_broker", lat: 41.9028, lng: 12.4964, certifications: ["AEO"], services: ["customs_broker", "ocean_lcl"] },
  { id: "19", company_name: "Tokyo Logistics Corp", city: "Tokyo", country_code: "JP", country_name: "Japan", email: "info@tlc.jp", partner_type: "freight_forwarder", lat: 35.6762, lng: 139.6503, certifications: ["IATA", "AEO", "ISO"], services: ["air_freight", "ocean_fcl", "pharma"] },
  { id: "20", company_name: "Osaka Freight Services", city: "Osaka", country_code: "JP", country_name: "Japan", email: "cargo@ofs.jp", partner_type: "nvocc", lat: 34.6937, lng: 135.5023, certifications: ["ISO"], services: ["ocean_fcl", "ocean_lcl", "ecommerce"] },
  { id: "21", company_name: "São Paulo Transporte Ltda", city: "São Paulo", country_code: "BR", country_name: "Brazil", email: "contato@spt.br", partner_type: "freight_forwarder", lat: -23.5505, lng: -46.6333, certifications: ["IATA"], services: ["air_freight", "road_freight"] },
  { id: "22", company_name: "Rio Cargo Express", city: "Rio de Janeiro", country_code: "BR", country_name: "Brazil", email: "info@rce.br", partner_type: "carrier", lat: -22.9068, lng: -43.1729, certifications: ["ISO"], services: ["ocean_fcl", "perishables"] },
  { id: "23", company_name: "New York Freight Inc", city: "New York", country_code: "US", country_name: "United States", email: "info@nyf.com", partner_type: "freight_forwarder", lat: 40.7128, lng: -74.006, certifications: ["IATA", "C-TPAT"], services: ["air_freight", "ocean_fcl", "pharma"] },
  { id: "24", company_name: "LA Cargo Solutions", city: "Los Angeles", country_code: "US", country_name: "United States", email: "ops@lacs.com", partner_type: "nvocc", lat: 34.0522, lng: -118.2437, certifications: ["C-TPAT"], services: ["ocean_fcl", "ocean_lcl", "ecommerce"] },
  { id: "25", company_name: "Chicago Logistics LLC", city: "Chicago", country_code: "US", country_name: "United States", email: "hello@cll.com", partner_type: "3pl", lat: 41.8781, lng: -87.6298, certifications: ["ISO"], services: ["warehousing", "rail_freight"] },
  { id: "26", company_name: "Paris Freight SARL", city: "Paris", country_code: "FR", country_name: "France", email: "contact@pf.fr", partner_type: "freight_forwarder", lat: 48.8566, lng: 2.3522, certifications: ["IATA", "AEO"], services: ["air_freight", "pharma"] },
  { id: "27", company_name: "Madrid Cargo SL", city: "Madrid", country_code: "ES", country_name: "Spain", email: "info@mc.es", partner_type: "freight_forwarder", lat: 40.4168, lng: -3.7038, certifications: ["IATA"], services: ["air_freight", "road_freight"] },
  { id: "28", company_name: "Mumbai Express Logistics", city: "Mumbai", country_code: "IN", country_name: "India", email: "ops@mel.in", partner_type: "freight_forwarder", lat: 19.076, lng: 72.8777, certifications: ["IATA", "ISO"], services: ["air_freight", "ocean_fcl", "pharma"] },
  { id: "29", company_name: "Seoul Air Cargo", city: "Seoul", country_code: "KR", country_name: "South Korea", email: "info@sac.kr", partner_type: "freight_forwarder", lat: 37.5665, lng: 126.978, certifications: ["IATA", "AEO"], services: ["air_freight", "ecommerce"] },
];

// Get unique countries with partner counts
export const COUNTRIES_WITH_PARTNERS = MOCK_PARTNERS.reduce((acc, p) => {
  if (!acc[p.country_code]) {
    acc[p.country_code] = {
      code: p.country_code,
      name: p.country_name,
      count: 0,
      lat: p.lat,
      lng: p.lng,
    };
  }
  acc[p.country_code].count++;
  return acc;
}, {} as Record<string, { code: string; name: string; count: number; lat: number; lng: number }>);

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// City marker that explodes in when country is selected
function CityMarker({ 
  partner, 
  isVisible, 
  delay 
}: { 
  partner: MockPartner; 
  isVisible: boolean;
  delay: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLngToVector3(partner.lat, partner.lng, 1.025), [partner]);
  const [scale, setScale] = useState(0);
  const targetScale = isVisible ? 1 : 0;

  useFrame((state) => {
    // Smooth scale animation with delay
    const time = state.clock.elapsedTime;
    if (isVisible && time > delay) {
      setScale(prev => THREE.MathUtils.lerp(prev, targetScale, 0.15));
    } else if (!isVisible) {
      setScale(prev => THREE.MathUtils.lerp(prev, 0, 0.2));
    }

    if (ref.current) {
      ref.current.scale.setScalar(scale);
      // Subtle pulse when visible
      if (isVisible && scale > 0.5) {
        const pulse = Math.sin(time * 3 + delay * 10) * 0.1 + 1;
        ref.current.scale.multiplyScalar(pulse);
      }
    }
  });

  if (scale < 0.01) return null;

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.012, 12, 12]} />
      <meshBasicMaterial color="#fef3c7" />
    </mesh>
  );
}

// Golden country highlight ring/border effect
function CountryHighlight({ 
  country, 
  isSelected 
}: { 
  country: { lat: number; lng: number };
  isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLngToVector3(country.lat, country.lng, 1.005), [country]);
  const [opacity, setOpacity] = useState(0);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Fade in/out
    setOpacity(prev => THREE.MathUtils.lerp(prev, isSelected ? 1 : 0, 0.1));

    if (groupRef.current && isSelected) {
      // Make rings face camera
      groupRef.current.lookAt(0, 0, 0);
    }

    // Animate rings
    if (ring1Ref.current) {
      const scale1 = isSelected ? 1 + Math.sin(time * 2) * 0.1 : 0;
      ring1Ref.current.scale.setScalar(scale1);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8;
    }
    if (ring2Ref.current) {
      const scale2 = isSelected ? 1.3 + Math.sin(time * 2 + 1) * 0.1 : 0;
      ring2Ref.current.scale.setScalar(scale2);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5;
    }
    if (ring3Ref.current) {
      const scale3 = isSelected ? ((time * 0.5) % 1) * 2 + 1 : 0;
      ring3Ref.current.scale.setScalar(scale3);
      (ring3Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * (1 - ((time * 0.5) % 1));
    }
  });

  if (opacity < 0.01) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Inner solid ring */}
      <mesh ref={ring1Ref} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.08, 0.1, 64]} />
        <meshBasicMaterial 
          color="#fbbf24" 
          transparent 
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Outer glow ring */}
      <mesh ref={ring2Ref} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.1, 0.15, 64]} />
        <meshBasicMaterial 
          color="#f59e0b" 
          transparent 
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Expanding pulse ring */}
      <mesh ref={ring3Ref} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.12, 0.13, 64]} />
        <meshBasicMaterial 
          color="#fcd34d" 
          transparent 
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// Country marker with hover and click
function CountryMarker({ 
  country, 
  isSelected, 
  onSelect 
}: { 
  country: { code: string; name: string; count: number; lat: number; lng: number };
  isSelected: boolean;
  onSelect: (code: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLngToVector3(country.lat, country.lng, 1.01), [country]);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (innerRef.current) {
      const pulse = isSelected 
        ? Math.sin(time * 4) * 0.3 + 1.5
        : hovered 
          ? Math.sin(time * 3) * 0.2 + 1.3
          : Math.sin(time * 2 + country.lat) * 0.1 + 1;
      innerRef.current.scale.setScalar(pulse);
    }

    if (outerRef.current) {
      const breathe = Math.sin(time * 2 + country.lat) * 0.2 + 0.8;
      outerRef.current.scale.setScalar(isSelected ? 3 : hovered ? 2.5 : breathe * 2);
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity = 
        isSelected ? 0.6 : hovered ? 0.5 : breathe * 0.3;
    }
  });

  const baseColor = isSelected ? "#fbbf24" : "#f59e0b";
  const glowColor = isSelected ? "#fef3c7" : "#fcd34d";

  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(country.code);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Inner core */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial color={glowColor} />
      </mesh>

      {/* Outer glow */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={baseColor} transparent opacity={0.4} />
      </mesh>

      {/* Point light */}
      <pointLight 
        color={baseColor} 
        intensity={isSelected ? 0.8 : hovered ? 0.5 : 0.15} 
        distance={0.4}
      />
    </group>
  );
}

// Connection arc
function ConnectionArc({ start, end, color = "#3b82f6" }: { start: THREE.Vector3; end: THREE.Vector3; color?: string }) {
  const lineObject = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const distance = start.distanceTo(end);
    mid.normalize().multiplyScalar(1 + distance * 0.15);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
    return new THREE.Line(geometry, material);
  }, [start, end, color]);

  return <primitive object={lineObject} />;
}

// Partner network connections
function PartnerNetwork() {
  const connections = useMemo(() => {
    const countries = Object.values(COUNTRIES_WITH_PARTNERS);
    const lines: { start: THREE.Vector3; end: THREE.Vector3; key: string }[] = [];
    const pairs = [
      ["GB", "US"], ["GB", "DE"], ["DE", "CN"], ["CN", "JP"], 
      ["US", "BR"], ["FR", "IT"], ["SG", "AU"], ["AE", "IN"],
      ["NL", "DE"], ["JP", "KR"], ["ES", "BR"], ["FR", "CN"],
    ];
    pairs.forEach(([a, b]) => {
      const countryA = countries.find(c => c.code === a);
      const countryB = countries.find(c => c.code === b);
      if (countryA && countryB) {
        lines.push({
          start: latLngToVector3(countryA.lat, countryA.lng, 1.01),
          end: latLngToVector3(countryB.lat, countryB.lng, 1.01),
          key: `${a}-${b}`,
        });
      }
    });
    return lines;
  }, []);

  return (
    <group>
      {connections.map((conn) => (
        <ConnectionArc key={conn.key} start={conn.start} end={conn.end} color="#60a5fa" />
      ))}
    </group>
  );
}

// Earth component with smooth zoom
function Earth({ 
  selectedCountry, 
  onCountrySelect,
  targetZoom,
  targetRotation
}: { 
  selectedCountry: string | null; 
  onCountrySelect: (code: string) => void;
  targetZoom: React.MutableRefObject<number>;
  targetRotation: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const earthRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const currentRotation = useRef({ x: 0, y: 0 });
  const selectionTime = useRef(0);

  // Get partners for selected country
  const countryPartners = useMemo(() => {
    if (!selectedCountry) return [];
    return MOCK_PARTNERS.filter(p => p.country_code === selectedCountry);
  }, [selectedCountry]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    // Smooth rotation interpolation
    if (earthRef.current) {
      if (!selectedCountry) {
        // Auto-rotate when nothing selected
        currentRotation.current.y += delta * 0.08;
      } else {
        // Smooth lerp to target rotation
        currentRotation.current.y = THREE.MathUtils.lerp(
          currentRotation.current.y,
          targetRotation.current.y,
          0.05
        );
      }
      earthRef.current.rotation.y = currentRotation.current.y;
    }
    
    // Cloud rotation
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.015;
    }

    // Smooth camera zoom
    const currentZ = camera.position.z;
    const newZ = THREE.MathUtils.lerp(currentZ, targetZoom.current, 0.05);
    camera.position.z = newZ;
  });

  // Calculate target rotation when country changes
  useEffect(() => {
    if (selectedCountry) {
      const country = COUNTRIES_WITH_PARTNERS[selectedCountry];
      if (country) {
        targetRotation.current.y = -(country.lng + 90) * (Math.PI / 180);
        targetZoom.current = 2.2; // Zoom in
        selectionTime.current = 0;
      }
    } else {
      targetZoom.current = 2.8; // Zoom out
    }
  }, [selectedCountry, targetRotation, targetZoom]);

  const countries = Object.values(COUNTRIES_WITH_PARTNERS);

  // Atmosphere shaders
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          vec3 atmosphere = vec3(0.3, 0.6, 1.0);
          gl_FragColor = vec4(atmosphere, 1.0) * intensity * 1.5;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  const innerGlowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.8 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
          vec3 glow = vec3(0.1, 0.4, 0.8);
          gl_FragColor = vec4(glow, intensity * 0.5);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  return (
    <group ref={earthRef}>
      {/* Atmosphere */}
      <Sphere args={[1.25, 64, 64]} material={atmosphereMaterial} />
      <Sphere args={[1.02, 64, 64]} material={innerGlowMaterial} />

      {/* Earth surface */}
      <Sphere args={[1, 128, 128]}>
        <meshPhongMaterial color="#0c1929" emissive="#0a1525" emissiveIntensity={0.1} shininess={25} />
      </Sphere>

      {/* Wireframe layers */}
      <Sphere args={[1.003, 128, 128]}>
        <meshPhongMaterial color="#1a365d" emissive="#1e3a5f" emissiveIntensity={0.15} transparent opacity={0.9} wireframe />
      </Sphere>
      <Sphere args={[1.006, 48, 48]}>
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.08} wireframe />
      </Sphere>

      {/* Clouds */}
      <Sphere ref={cloudsRef} args={[1.015, 64, 64]}>
        <meshPhongMaterial color="#ffffff" transparent opacity={0.04} />
      </Sphere>

      {/* Network */}
      <PartnerNetwork />

      {/* Country markers */}
      {countries.map((country) => (
        <CountryMarker
          key={country.code}
          country={country}
          isSelected={selectedCountry === country.code}
          onSelect={onCountrySelect}
        />
      ))}

      {/* Country highlight rings */}
      {countries.map((country) => (
        <CountryHighlight
          key={`highlight-${country.code}`}
          country={country}
          isSelected={selectedCountry === country.code}
        />
      ))}

      {/* City markers that explode in */}
      {countryPartners.map((partner, index) => (
        <CityMarker
          key={partner.id}
          partner={partner}
          isVisible={selectedCountry === partner.country_code}
          delay={index * 0.1}
        />
      ))}
    </group>
  );
}

// Scene setup
function GlobeScene({ 
  selectedCountry, 
  onCountrySelect 
}: { 
  selectedCountry: string | null; 
  onCountrySelect: (code: string) => void;
}) {
  const controlsRef = useRef<any>(null);
  const targetZoom = useRef(2.8);
  const targetRotation = useRef({ x: 0, y: 0 });

  return (
    <>
      <ambientLight intensity={0.2} color="#6366f1" />
      <directionalLight position={[5, 3, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-5, -3, -5]} intensity={0.4} color="#3b82f6" />
      <pointLight position={[3, 2, 4]} intensity={0.5} color="#60a5fa" />
      <pointLight position={[-3, -2, -4]} intensity={0.3} color="#a78bfa" />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.5} fade speed={0.5} />

      <Earth 
        selectedCountry={selectedCountry} 
        onCountrySelect={onCountrySelect}
        targetZoom={targetZoom}
        targetRotation={targetRotation}
      />

      <OrbitControls
        ref={controlsRef}
        enableZoom={true}
        enablePan={false}
        minDistance={1.6}
        maxDistance={4}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

// Partner popup component
function PartnerPopup({ 
  partners, 
  countryName 
}: { 
  partners: MockPartner[]; 
  countryName: string;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 max-w-[calc(100%-2rem)] bg-card/95 backdrop-blur-md border border-amber-400/30 rounded-xl shadow-2xl z-30 animate-scale-in overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-3 border-b border-amber-400/20">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-amber-100">{countryName}</span>
          <span className="ml-auto text-xs bg-amber-500/30 px-2 py-0.5 rounded-full text-amber-200">
            {partners.length} partner
          </span>
        </div>
      </div>
      
      {/* Partner list */}
      <ScrollArea className="h-40">
        <div className="p-2 space-y-1">
          {partners.map((partner) => (
            <div 
              key={partner.id} 
              className="p-2 rounded-lg hover:bg-primary/5 transition-colors group"
            >
              <p className="font-medium text-sm text-foreground/90 truncate">
                {partner.company_name}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {partner.city}
                </span>
                {partner.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    <span className="truncate max-w-24">{partner.email}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface CampaignGlobeProps {
  selectedCountry: string | null;
  onCountrySelect: (countryCode: string | null) => void;
}

export function CampaignGlobe({ selectedCountry, onCountrySelect }: CampaignGlobeProps) {
  const countries = Object.values(COUNTRIES_WITH_PARTNERS);
  
  // Get partners for popup
  const countryPartners = useMemo(() => {
    if (!selectedCountry) return [];
    return MOCK_PARTNERS.filter(p => p.country_code === selectedCountry);
  }, [selectedCountry]);

  const handleGlobeCountrySelect = useCallback((code: string) => {
    onCountrySelect(code === selectedCountry ? null : code);
  }, [selectedCountry, onCountrySelect]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/50 pointer-events-none z-10" />
      
      {/* Dropdown */}
      <div className="absolute top-4 left-4 right-4 z-20">
        <Select value={selectedCountry || ""} onValueChange={(val) => onCountrySelect(val || null)}>
          <SelectTrigger className="bg-card/95 backdrop-blur-md border-primary/20 shadow-lg">
            <SelectValue placeholder="🌍 Seleziona un paese..." />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-md">
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCountryFlag(country.code)}</span>
                  <span>{country.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs">{country.count} partner</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected country indicator */}
      {selectedCountry && (
        <div className="absolute top-16 left-4 right-4 z-20">
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-500/20 border border-amber-400/40 rounded-xl p-3 text-center backdrop-blur-md shadow-lg animate-fade-in">
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">{getCountryFlag(selectedCountry)}</span>
              <div className="text-left">
                <p className="font-semibold text-amber-100">{COUNTRIES_WITH_PARTNERS[selectedCountry]?.name}</p>
                <p className="text-xs text-amber-200/70">{COUNTRIES_WITH_PARTNERS[selectedCountry]?.count} partner disponibili</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 50 }}
        style={{ background: "linear-gradient(180deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)" }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <GlobeScene selectedCountry={selectedCountry} onCountrySelect={handleGlobeCountrySelect} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-md border border-primary/20 rounded-xl p-4 text-xs space-y-3 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-amber-400/50 animate-ping" />
          </div>
          <span className="text-foreground/80">Paesi con partner</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-px bg-gradient-to-r from-blue-400 to-blue-600" />
          <span className="text-foreground/80">Connessioni network</span>
        </div>
        <p className="text-muted-foreground pt-1 border-t border-primary/10">
          Clicca per selezionare · Trascina per ruotare
        </p>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-md border border-primary/20 rounded-xl p-4 z-20 shadow-xl">
        <div className="text-center">
          <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {Object.keys(COUNTRIES_WITH_PARTNERS).length}
          </p>
          <p className="text-xs text-muted-foreground">Paesi</p>
        </div>
        <div className="w-px h-4 bg-primary/20 mx-auto my-2" />
        <div className="text-center">
          <p className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            {MOCK_PARTNERS.length}
          </p>
          <p className="text-xs text-muted-foreground">Partner</p>
        </div>
      </div>

      {/* Partner popup */}
      {selectedCountry && countryPartners.length > 0 && (
        <PartnerPopup 
          partners={countryPartners} 
          countryName={COUNTRIES_WITH_PARTNERS[selectedCountry]?.name || ''} 
        />
      )}
    </div>
  );
}

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";
import * as THREE from "three";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getCountryFlag } from "@/lib/countries";

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

interface CountryMarkerProps {
  country: { code: string; name: string; count: number; lat: number; lng: number };
  isSelected: boolean;
  onSelect: (code: string) => void;
}

function CountryMarker({ country, isSelected, onSelect }: CountryMarkerProps) {
  const ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLngToVector3(country.lat, country.lng, 1.02), [country]);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (ref.current) {
      const targetScale = isSelected ? 2 : hovered ? 1.5 : 1;
      ref.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  // Pulse animation for selected
  useFrame((state) => {
    if (ref.current && isSelected) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 1;
      ref.current.scale.multiplyScalar(pulse);
    }
  });

  return (
    <mesh
      ref={ref}
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
      <sphereGeometry args={[0.035, 16, 16]} />
      <meshStandardMaterial
        color={isSelected ? "#eab308" : "#eab308"}
        emissive={isSelected ? "#eab308" : "#ca8a04"}
        emissiveIntensity={isSelected ? 1.5 : hovered ? 1 : 0.6}
        transparent
        opacity={isSelected ? 1 : 0.8}
      />
    </mesh>
  );
}

function GlobeScene({ 
  selectedCountry, 
  onCountrySelect 
}: { 
  selectedCountry: string | null; 
  onCountrySelect: (code: string) => void;
}) {
  const globeRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);

  // Rotate to selected country
  useEffect(() => {
    if (selectedCountry && controlsRef.current) {
      const country = COUNTRIES_WITH_PARTNERS[selectedCountry];
      if (country) {
        const pos = latLngToVector3(country.lat, country.lng, 3);
        // Animate camera
        controlsRef.current.autoRotate = false;
      }
    }
  }, [selectedCountry]);

  // Slow auto-rotation
  useFrame((state, delta) => {
    if (globeRef.current && !selectedCountry) {
      globeRef.current.rotation.y += delta * 0.05;
    }
  });

  // Atmosphere shader
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
          float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
  }, []);

  const countries = Object.values(COUNTRIES_WITH_PARTNERS);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0ea5e9" />

      {/* Atmosphere glow */}
      <Sphere args={[1.15, 64, 64]} material={atmosphereMaterial} />

      {/* Earth */}
      <group ref={globeRef}>
        <Sphere args={[1, 64, 64]}>
          <meshStandardMaterial
            color="#1e3a5f"
            roughness={0.8}
            metalness={0.1}
          />
        </Sphere>

        {/* Wireframe overlay */}
        <Sphere args={[1.001, 32, 32]}>
          <meshStandardMaterial
            color="#2d5a87"
            transparent
            opacity={0.3}
            wireframe
          />
        </Sphere>

        {/* Country markers */}
        {countries.map((country) => (
          <CountryMarker
            key={country.code}
            country={country}
            isSelected={selectedCountry === country.code}
            onSelect={onCountrySelect}
          />
        ))}
      </group>

      <OrbitControls
        ref={controlsRef}
        enableZoom={true}
        enablePan={false}
        minDistance={2}
        maxDistance={4}
        autoRotate={!selectedCountry}
        autoRotateSpeed={0.3}
      />
    </>
  );
}

interface CampaignGlobeProps {
  selectedCountry: string | null;
  onCountrySelect: (countryCode: string | null) => void;
}

export function CampaignGlobe({ selectedCountry, onCountrySelect }: CampaignGlobeProps) {
  const countries = Object.values(COUNTRIES_WITH_PARTNERS);

  const handleGlobeCountrySelect = useCallback((code: string) => {
    onCountrySelect(code === selectedCountry ? null : code);
  }, [selectedCountry, onCountrySelect]);

  return (
    <div className="relative w-full h-full">
      {/* Dropdown synced with globe */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <Select 
          value={selectedCountry || ""} 
          onValueChange={(val) => onCountrySelect(val || null)}
        >
          <SelectTrigger className="bg-card/90 backdrop-blur-sm">
            <SelectValue placeholder="Seleziona un paese..." />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center gap-2">
                  <span>{getCountryFlag(country.code)}</span>
                  <span>{country.name}</span>
                  <span className="text-muted-foreground ml-auto">
                    ({country.count})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 3D Globe */}
      <Canvas
        camera={{ position: [0, 0, 3], fov: 45 }}
        className="bg-gradient-to-b from-slate-900 via-slate-950 to-black"
      >
        <GlobeScene 
          selectedCountry={selectedCountry} 
          onCountrySelect={handleGlobeCountrySelect}
        />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border rounded-lg p-3 text-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Paesi con partner</span>
        </div>
        <p className="text-muted-foreground">
          Clicca su un marker per selezionare
        </p>
      </div>

      {/* Selected country indicator */}
      {selectedCountry && (
        <div className="absolute top-16 left-4 right-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-2 text-sm text-center">
          <span className="mr-2">{getCountryFlag(selectedCountry)}</span>
          <span className="font-medium">
            {COUNTRIES_WITH_PARTNERS[selectedCountry]?.name}
          </span>
          <span className="text-muted-foreground ml-2">
            ({COUNTRIES_WITH_PARTNERS[selectedCountry]?.count} partner)
          </span>
        </div>
      )}
    </div>
  );
}

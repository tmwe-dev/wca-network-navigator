import { useRef, useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { TexturedEarth, SimpleEarth } from "./TexturedEarth";
import { AuroraBorealis } from "./AuroraBorealis";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getCountryFlag } from "@/lib/countries";
import { Building2, Mail, MapPin, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePartnersForGlobe, usePartnersByCountryForGlobe, type GlobePartner, type CountryWithPartners } from "@/hooks/usePartnersForGlobe";
import { WCA_COUNTRIES_MAP, TOTAL_WCA_COUNTRIES } from "@/data/wcaCountries";

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
  partner: GlobePartner; 
  isVisible: boolean;
  delay: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLngToVector3(partner.lat, partner.lng, 1.025), [partner]);
  const [scale, setScale] = useState(0);
  const targetScale = isVisible ? 1 : 0;

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (isVisible && time > delay) {
      setScale(prev => THREE.MathUtils.lerp(prev, targetScale, 0.15));
    } else if (!isVisible) {
      setScale(prev => THREE.MathUtils.lerp(prev, 0, 0.2));
    }

    if (ref.current) {
      ref.current.scale.setScalar(scale);
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
    setOpacity(prev => THREE.MathUtils.lerp(prev, isSelected ? 1 : 0, 0.1));

    if (groupRef.current && isSelected) {
      groupRef.current.lookAt(0, 0, 0);
    }

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
      <mesh ref={ring1Ref} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.08, 0.1, 64]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.1, 0.15, 64]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring3Ref} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.12, 0.13, 64]} />
        <meshBasicMaterial color="#fcd34d" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Country marker with hover and click
function CountryMarker({ 
  country, 
  isSelected, 
  onSelect,
  hasPartners
}: { 
  country: CountryWithPartners;
  isSelected: boolean;
  onSelect: (code: string) => void;
  hasPartners: boolean;
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
      innerRef.current.scale.setScalar(pulse * (hasPartners ? 1 : 0.6));
    }

    if (outerRef.current) {
      const breathe = Math.sin(time * 2 + country.lat) * 0.2 + 0.8;
      outerRef.current.scale.setScalar(isSelected ? 3 : hovered ? 2.5 : breathe * 2);
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity = 
        isSelected ? 0.6 : hovered ? 0.5 : breathe * (hasPartners ? 0.3 : 0.1);
    }
  });

  // Different colors based on whether country has partners
  const baseColor = hasPartners 
    ? (isSelected ? "#fbbf24" : "#f59e0b")
    : "#6b7280"; // Gray for countries without partners
  const glowColor = hasPartners 
    ? (isSelected ? "#fef3c7" : "#fcd34d")
    : "#9ca3af";

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
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial color={glowColor} />
      </mesh>
      <mesh ref={outerRef}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={baseColor} transparent opacity={0.4} />
      </mesh>
      <pointLight 
        color={baseColor} 
        intensity={isSelected ? 0.8 : hovered ? 0.5 : (hasPartners ? 0.15 : 0.05)} 
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
function PartnerNetwork({ countries }: { countries: CountryWithPartners[] }) {
  const connections = useMemo(() => {
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
  }, [countries]);

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
  targetRotation,
  countries,
  countryPartners
}: { 
  selectedCountry: string | null; 
  onCountrySelect: (code: string) => void;
  targetZoom: React.MutableRefObject<number>;
  targetRotation: React.MutableRefObject<{ x: number; y: number }>;
  countries: CountryWithPartners[];
  countryPartners: GlobePartner[];
}) {
  const earthRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const currentRotation = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (earthRef.current) {
      if (!selectedCountry) {
        currentRotation.current.y += delta * 0.08;
      } else {
        currentRotation.current.y = THREE.MathUtils.lerp(
          currentRotation.current.y,
          targetRotation.current.y,
          0.05
        );
      }
      earthRef.current.rotation.y = currentRotation.current.y;
    }

    const currentZ = camera.position.z;
    const newZ = THREE.MathUtils.lerp(currentZ, targetZoom.current, 0.05);
    camera.position.z = newZ;
  });

  useEffect(() => {
    if (selectedCountry) {
      const country = WCA_COUNTRIES_MAP[selectedCountry];
      if (country) {
        targetRotation.current.y = -(country.lng + 90) * (Math.PI / 180);
        targetZoom.current = 2.2;
      }
    } else {
      targetZoom.current = 2.8;
    }
  }, [selectedCountry, targetRotation, targetZoom]);

  return (
    <group ref={earthRef}>
      <Suspense fallback={<SimpleEarth />}>
        <TexturedEarth rotation={0} />
      </Suspense>

      <AuroraBorealis />
      <PartnerNetwork countries={countries} />

      {countries.map((country) => (
        <CountryMarker
          key={country.code}
          country={country}
          isSelected={selectedCountry === country.code}
          onSelect={onCountrySelect}
          hasPartners={country.count > 0}
        />
      ))}

      {countries.filter(c => c.count > 0).map((country) => (
        <CountryHighlight
          key={`highlight-${country.code}`}
          country={country}
          isSelected={selectedCountry === country.code}
        />
      ))}

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
  onCountrySelect,
  countries,
  countryPartners
}: { 
  selectedCountry: string | null; 
  onCountrySelect: (code: string) => void;
  countries: CountryWithPartners[];
  countryPartners: GlobePartner[];
}) {
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
        countries={countries}
        countryPartners={countryPartners}
      />

      <OrbitControls
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
  partners: GlobePartner[]; 
  countryName: string;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 max-w-[calc(100%-2rem)] bg-card/95 backdrop-blur-md border border-amber-400/30 rounded-xl shadow-2xl z-30 animate-scale-in overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-3 border-b border-amber-400/20">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-amber-100">{countryName}</span>
          <span className="ml-auto text-xs bg-amber-500/30 px-2 py-0.5 rounded-full text-amber-200">
            {partners.length} partner
          </span>
        </div>
      </div>
      
      <ScrollArea className="h-40">
        <div className="p-2 space-y-1">
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2 text-center">Nessun partner in questo paese</p>
          ) : (
            partners.map((partner) => (
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
            ))
          )}
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
  // Fetch real data from Supabase
  const { data: globeData, isLoading } = usePartnersForGlobe();
  const { data: countryPartners = [] } = usePartnersByCountryForGlobe(selectedCountry);
  
  const countries = globeData?.countries || [];
  const countriesMap = globeData?.countriesMap || {};
  const totalPartners = globeData?.partners.length || 0;
  const countriesWithPartners = countries.filter(c => c.count > 0).length;

  const handleGlobeCountrySelect = useCallback((code: string) => {
    onCountrySelect(code === selectedCountry ? null : code);
  }, [selectedCountry, onCountrySelect]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-muted-foreground text-sm">Caricamento globo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/50 pointer-events-none z-10" />
      
      {/* Dropdown */}
      <div className="absolute top-4 left-4 right-4 z-20">
        <Select value={selectedCountry || ""} onValueChange={(val) => onCountrySelect(val || null)}>
          <SelectTrigger className="bg-card/95 backdrop-blur-md border-primary/20 shadow-lg">
            <SelectValue placeholder="🌍 Seleziona un paese..." />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-md max-h-80">
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCountryFlag(country.code)}</span>
                  <span>{country.name}</span>
                  <span className={`ml-auto text-xs ${country.count > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                    {country.count} partner
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected country indicator */}
      {selectedCountry && countriesMap[selectedCountry] && (
        <div className="absolute top-16 left-4 right-4 z-20">
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-500/20 border border-amber-400/40 rounded-xl p-3 text-center backdrop-blur-md shadow-lg animate-fade-in">
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">{getCountryFlag(selectedCountry)}</span>
              <div className="text-left">
                <p className="font-semibold text-amber-100">{countriesMap[selectedCountry]?.name}</p>
                <p className="text-xs text-amber-200/70">{countriesMap[selectedCountry]?.count || 0} partner disponibili</p>
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
        <GlobeScene 
          selectedCountry={selectedCountry} 
          onCountrySelect={handleGlobeCountrySelect}
          countries={countries}
          countryPartners={countryPartners}
        />
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
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-foreground/80">Paesi senza partner</span>
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
            {TOTAL_WCA_COUNTRIES}
          </p>
          <p className="text-xs text-muted-foreground">Paesi WCA</p>
        </div>
        <div className="w-px h-4 bg-primary/20 mx-auto my-2" />
        <div className="text-center">
          <p className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            {countriesWithPartners}
          </p>
          <p className="text-xs text-muted-foreground">Con partner</p>
        </div>
        <div className="w-px h-4 bg-primary/20 mx-auto my-2" />
        <div className="text-center">
          <p className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            {totalPartners}
          </p>
          <p className="text-xs text-muted-foreground">Partner totali</p>
        </div>
      </div>

      {/* Partner popup */}
      {selectedCountry && (
        <PartnerPopup 
          partners={countryPartners} 
          countryName={countriesMap[selectedCountry]?.name || ''} 
        />
      )}
    </div>
  );
}

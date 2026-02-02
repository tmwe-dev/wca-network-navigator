import { useRef, useMemo, useCallback, useEffect, Suspense } from "react";
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

// Optimized components
import { InstancedCountryMarkers } from "./globe/InstancedCountryMarkers";
import { SelectionHighlight } from "./globe/SelectionHighlight";
import { CityMarkers } from "./globe/CityMarkers";
import { NetworkConnections } from "./globe/NetworkConnections";

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

  // Get selected country data for highlight
  const selectedCountryData = useMemo(() => {
    if (!selectedCountry) return null;
    return countries.find(c => c.code === selectedCountry) || null;
  }, [selectedCountry, countries]);

  return (
    <group ref={earthRef}>
      <Suspense fallback={<SimpleEarth />}>
        <TexturedEarth rotation={0} />
      </Suspense>

      <AuroraBorealis />
      <NetworkConnections countries={countries} />

      {/* Single instanced mesh for all 249 country markers */}
      <InstancedCountryMarkers
        countries={countries}
        selectedCountry={selectedCountry}
        onSelect={onCountrySelect}
      />

      {/* Single highlight for selected country */}
      {selectedCountryData && (
        <SelectionHighlight
          lat={selectedCountryData.lat}
          lng={selectedCountryData.lng}
          isVisible={true}
        />
      )}

      {/* City markers for selected country's partners */}
      <CityMarkers
        partners={countryPartners}
        isVisible={!!selectedCountry}
      />
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
    <div className="w-80 max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-md border border-amber-400/30 rounded-xl shadow-2xl animate-scale-in overflow-hidden">
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar - Controls & Stats */}
      <div className="flex-shrink-0 p-4 bg-gradient-to-b from-slate-950 to-transparent space-y-3">
        {/* Row 1: Dropdown + Stats */}
        <div className="flex items-center gap-4">
          {/* Country selector */}
          <div className="flex-1 max-w-md">
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

          {/* Stats row - inline */}
          <div className="flex items-center gap-6 bg-card/80 backdrop-blur-md border border-primary/20 rounded-xl px-4 py-2">
            <div className="text-center">
              <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {TOTAL_WCA_COUNTRIES}
              </p>
              <p className="text-[10px] text-muted-foreground">Paesi WCA</p>
            </div>
            <div className="w-px h-8 bg-primary/20" />
            <div className="text-center">
              <p className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                {countriesWithPartners}
              </p>
              <p className="text-[10px] text-muted-foreground">Con partner</p>
            </div>
            <div className="w-px h-8 bg-primary/20" />
            <div className="text-center">
              <p className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                {totalPartners}
              </p>
              <p className="text-[10px] text-muted-foreground">Partner</p>
            </div>
          </div>

          {/* Legend - inline */}
          <div className="hidden lg:flex items-center gap-4 bg-card/80 backdrop-blur-md border border-primary/20 rounded-xl px-4 py-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              </div>
              <span className="text-foreground/80">Con partner</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
              <span className="text-foreground/80">Senza partner</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-px bg-gradient-to-r from-blue-400 to-blue-600" />
              <span className="text-foreground/80">Network</span>
            </div>
          </div>
        </div>

        {/* Selected country indicator */}
        {selectedCountry && countriesMap[selectedCountry] && (
          <div className="max-w-md">
            <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-500/20 border border-amber-400/40 rounded-xl p-2.5 backdrop-blur-md shadow-lg animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="text-xl">{getCountryFlag(selectedCountry)}</span>
                <div>
                  <p className="font-semibold text-amber-100 text-sm">{countriesMap[selectedCountry]?.name}</p>
                  <p className="text-xs text-amber-200/70">{countriesMap[selectedCountry]?.count || 0} partner disponibili</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Globe - takes remaining space */}
      <div className="flex-1 relative min-h-0">
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

        {/* Partner popup - inside globe area at bottom */}
        {selectedCountry && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <PartnerPopup 
              partners={countryPartners} 
              countryName={countriesMap[selectedCountry]?.name || ''} 
            />
          </div>
        )}

        {/* Mobile legend */}
        <div className="lg:hidden absolute bottom-4 left-4 bg-card/90 backdrop-blur-md border border-primary/20 rounded-lg px-3 py-2 text-[10px] z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Partner</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              <span>Vuoto</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

// Earth component with smooth zoom and rotation to selected country
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
  const autoRotate = useRef(true);

  useFrame((state, delta) => {
    if (earthRef.current) {
      if (!selectedCountry && autoRotate.current) {
        // Slow auto-rotation when no country selected
        currentRotation.current.y += delta * 0.08;
      } else if (selectedCountry) {
        // Smooth interpolation to target rotation (looking at the country)
        currentRotation.current.x = THREE.MathUtils.lerp(
          currentRotation.current.x,
          targetRotation.current.x,
          0.03
        );
        currentRotation.current.y = THREE.MathUtils.lerp(
          currentRotation.current.y,
          targetRotation.current.y,
          0.03
        );
      }
      earthRef.current.rotation.x = currentRotation.current.x;
      earthRef.current.rotation.y = currentRotation.current.y;
    }

    // Smooth zoom interpolation with easing
    const currentZ = camera.position.z;
    const diff = targetZoom.current - currentZ;
    const newZ = currentZ + diff * 0.04; // Smoother zoom
    camera.position.z = newZ;
  });

  useEffect(() => {
    if (selectedCountry) {
      const country = WCA_COUNTRIES_MAP[selectedCountry];
      if (country) {
        // Calculate rotation to position the country facing the camera
        // Longitude determines Y rotation (horizontal)
        // Latitude determines X rotation (tilt) - inverted because we're rotating the earth, not the camera
        const lngRad = -((country.lng + 90) * (Math.PI / 180));
        const latRad = (country.lat * (Math.PI / 180)) * 0.5; // Subtle tilt based on latitude
        
        targetRotation.current.y = lngRad;
        targetRotation.current.x = -latRad;
        targetZoom.current = 2.0; // Closer zoom when country selected
        autoRotate.current = false;
      }
    } else {
      targetZoom.current = 2.8;
      targetRotation.current.x = 0;
      autoRotate.current = true;
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
        minDistance={1.5}
        maxDistance={4}
        rotateSpeed={0.4}
        zoomSpeed={0.5}
        enableDamping={true}
        dampingFactor={0.08}
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
    <div className="relative w-full h-full">
      {/* Globe Canvas - Full area */}
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

      {/* Selected country popup - minimal overlay at bottom */}
      {selectedCountry && countriesMap[selectedCountry] && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <PartnerPopup 
            partners={countryPartners} 
            countryName={countriesMap[selectedCountry]?.name || ''} 
          />
        </div>
      )}

      {/* Minimal legend - bottom left corner */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] text-muted-foreground bg-black/40 backdrop-blur-sm rounded px-2 py-1">
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
  );
}

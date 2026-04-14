import { useRef, useMemo, useCallback, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { TexturedEarth, SimpleEarth } from "./TexturedEarth";
import { AuroraBorealis } from "./AuroraBorealis";
import { Loader2 } from "lucide-react";
import { usePartnersForGlobe, usePartnersByCountryForGlobe, type GlobePartner, type CountryWithPartners } from "@/hooks/usePartnersForGlobe";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";

// Optimized components
import { InstancedCountryMarkers } from "./globe/InstancedCountryMarkers";
import { SelectionHighlight } from "./globe/SelectionHighlight";
import { CityMarkers } from "./globe/CityMarkers";
import { NetworkConnections } from "./globe/NetworkConnections";
import { FlyingAirplanes } from "./globe/FlyingAirplanes";
import { CountryToast } from "./globe/CountryToast";

import { easeInOutCubic } from "./globe/utils";

// Earth component with smooth zoom and rotation to selected country
function Earth({ 
  selectedCountry, 
  onCountrySelect,
  targetZoom,
  targetRotation,
  countries,
  countryPartners,
  userInteracting,
  isResetting
}: { 
  selectedCountry: string | null; 
  onCountrySelect: (code: string) => void;
  targetZoom: React.MutableRefObject<number>;
  targetRotation: React.MutableRefObject<{ x: number; y: number }>;
  countries: CountryWithPartners[];
  countryPartners: GlobePartner[];
  userInteracting: React.MutableRefObject<boolean>;
  isResetting: React.MutableRefObject<boolean>;
}) {
  const earthRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const currentRotation = useRef({ x: 0, y: 0 });
  const resetStartTimeRef = useRef<number>(0);
  const resetStartZoomRef = useRef<number>(2.8);
  const resetStartRotationRef = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (earthRef.current) {
      const time = state.clock.elapsedTime;
      
      // Handle reset animation
      if (isResetting.current) {
        const resetDuration = 1.5; // 1.5 second smooth reset
        const elapsed = time - resetStartTimeRef.current;
        const progress = Math.min(elapsed / resetDuration, 1);
        const eased = easeInOutCubic(progress);
        
        // Interpolate rotation back to origin
        currentRotation.current.x = resetStartRotationRef.current.x * (1 - eased);
        currentRotation.current.y = resetStartRotationRef.current.y + (targetRotation.current.y - resetStartRotationRef.current.y) * eased + delta * 0.08 * eased;
        
        // Smooth zoom out
        const _currentZ = camera.position.z;
        const targetZ = resetStartZoomRef.current + (targetZoom.current - resetStartZoomRef.current) * eased;
        camera.position.z = targetZ;
        
        if (progress >= 1) {
          isResetting.current = false;
          userInteracting.current = false;
        }
      }
      // Only auto-rotate if user hasn't interacted and not resetting
      else if (!selectedCountry && !userInteracting.current) {
        currentRotation.current.y += delta * 0.08;
        
        // Smooth zoom interpolation
        const currentZ = camera.position.z;
        const diff = targetZoom.current - currentZ;
        camera.position.z = currentZ + diff * 0.04;
      } else if (selectedCountry && !userInteracting.current) {
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
        
        // Smooth zoom interpolation
        const currentZ = camera.position.z;
        const diff = targetZoom.current - currentZ;
        camera.position.z = currentZ + diff * 0.04;
      }
      
      earthRef.current.rotation.x = currentRotation.current.x;
      earthRef.current.rotation.y = currentRotation.current.y;
    }
  });

  useEffect(() => {
    if (selectedCountry) {
      // Reset user interaction to allow smooth movement to target
      userInteracting.current = false;
      
      const country = WCA_COUNTRIES_MAP[selectedCountry];
      if (country) {
        // Rotate globe so the selected country faces the camera.
        // With our lat/lng -> Vector3 mapping, the correct yaw to bring a point to +Z is: -(lng + 90°).
        // Pitch is simply +lat (keeps the selected point centered vertically without flipping hemispheres).
        const lngRad = THREE.MathUtils.degToRad(-(country.lng + 90));
        const latRad = THREE.MathUtils.degToRad(country.lat);
        
        targetRotation.current.y = lngRad;
        targetRotation.current.x = latRad;
        targetZoom.current = 1.6; // 20% more zoom than before
      }
    } else if (!selectedCountry && !isResetting.current) {
      targetZoom.current = 2.8;
      targetRotation.current.x = 0;
    }
  }, [selectedCountry, targetRotation, targetZoom, userInteracting, isResetting]);

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

      {/* Flying airplanes when globe is free */}
      <FlyingAirplanes 
        countries={countries} 
        isActive={!selectedCountry && !userInteracting.current}
      />

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
  countryPartners,
  userInteracting,
  isResetting,
  onStartReset: _onStartReset
}: { 
  selectedCountry: string | null; 
  onCountrySelect: (code: string) => void;
  countries: CountryWithPartners[];
  countryPartners: GlobePartner[];
  userInteracting: React.MutableRefObject<boolean>;
  isResetting: React.MutableRefObject<boolean>;
  onStartReset: () => void;
}) {
  const targetZoom = useRef(2.8);
  const targetRotation = useRef({ x: 0, y: 0 });

  const handleOrbitStart = useCallback(() => {
    userInteracting.current = true;
  }, [userInteracting]);

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
        userInteracting={userInteracting}
        isResetting={isResetting}
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
        onStart={handleOrbitStart}
      />
    </>
  );
}

interface CampaignGlobeProps {
  selectedCountry: string | null;
  onCountrySelect: (countryCode: string | null) => void;
}

export function CampaignGlobe({ selectedCountry, onCountrySelect }: CampaignGlobeProps) {
  // Fetch real data from Supabase
  const { data: globeData, isLoading } = usePartnersForGlobe();
  const { data: countryPartners = [] } = usePartnersByCountryForGlobe(selectedCountry) as { data: any[] };
  
  const countries = globeData?.countries || [];
  const userInteracting = useRef(false);
  const isResetting = useRef(false);

  const handleGlobeCountrySelect = useCallback((code: string) => {
    onCountrySelect(code === selectedCountry ? null : code);
  }, [selectedCountry, onCountrySelect]);

  // Handle reset - trigger smooth animation back to original state
  const handleStartReset = useCallback(() => {
    isResetting.current = true;
    userInteracting.current = false;
  }, []);

  // Reset when country is deselected
  useEffect(() => {
    if (!selectedCountry && userInteracting.current) {
      handleStartReset();
    }
  }, [selectedCountry, handleStartReset]);

  if (isLoading) {
    return (
       <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/20">
         <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-8 h-8 animate-spin text-primary" />
           <p className="text-muted-foreground text-sm">Caricamento globo...</p>
         </div>
       </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Country name toast */}
      <CountryToast countryCode={selectedCountry} />

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
          userInteracting={userInteracting}
          isResetting={isResetting}
          onStartReset={handleStartReset}
        />
      </Canvas>

      {/* Minimal legend - bottom left corner */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] text-muted-foreground bg-black/40 backdrop-blur-sm rounded px-2 py-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
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

export default CampaignGlobe;

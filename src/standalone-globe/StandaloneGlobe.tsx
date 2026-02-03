import { useRef, useMemo, useCallback, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { TexturedEarth, SimpleEarth } from "./components/TexturedEarth";
import { AuroraBorealis } from "./components/AuroraBorealis";
import { InstancedCountryMarkers } from "./components/globe/InstancedCountryMarkers";
import { SelectionHighlight } from "./components/globe/SelectionHighlight";
import { CityMarkers } from "./components/globe/CityMarkers";
import { NetworkConnections } from "./components/globe/NetworkConnections";
import { FlyingAirplanes } from "./components/globe/FlyingAirplanes";
import { CountryToast } from "./components/globe/CountryToast";
import { WCA_COUNTRIES_MAP, DEFAULT_COUNTRIES } from "./data/wcaCountries";
import { easeInOutCubic } from "./utils";
import { StandaloneGlobeProps, CountryWithPartners, GlobePartner } from "./types";

interface EarthProps {
  selectedCountry: string | null;
  onCountrySelect: (code: string) => void;
  targetZoom: React.MutableRefObject<number>;
  targetRotation: React.MutableRefObject<{ x: number; y: number }>;
  countries: CountryWithPartners[];
  countryPartners: GlobePartner[];
  userInteracting: React.MutableRefObject<boolean>;
  isResetting: React.MutableRefObject<boolean>;
}

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
}: EarthProps) {
  const earthRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const currentRotation = useRef({ x: 0, y: 0 });
  const resetStartTimeRef = useRef<number>(0);
  const resetStartZoomRef = useRef<number>(2.8);
  const resetStartRotationRef = useRef({ x: 0, y: 0 });

  // Trigger reset animation when deselecting
  useEffect(() => {
    if (!selectedCountry && userInteracting.current) {
      // Start reset animation
      isResetting.current = true;
      resetStartTimeRef.current = 0; // Will be set on first frame
      resetStartRotationRef.current = { ...currentRotation.current };
      resetStartZoomRef.current = camera.position.z;
    }
  }, [selectedCountry, userInteracting, isResetting, camera]);

  useFrame((state, delta) => {
    if (earthRef.current) {
      const time = state.clock.elapsedTime;
      
      // Handle reset animation
      if (isResetting.current) {
        // Initialize start time on first frame of reset
        if (resetStartTimeRef.current === 0) {
          resetStartTimeRef.current = time;
        }
        
        const resetDuration = 1.5;
        const elapsed = time - resetStartTimeRef.current;
        const progress = Math.min(elapsed / resetDuration, 1);
        const eased = easeInOutCubic(progress);
        
        // Animate rotation back to neutral with continuous Y rotation
        currentRotation.current.x = resetStartRotationRef.current.x * (1 - eased);
        currentRotation.current.y = resetStartRotationRef.current.y + delta * 0.08 * eased;
        
        // Animate zoom back to default
        const targetZ = resetStartZoomRef.current + (targetZoom.current - resetStartZoomRef.current) * eased;
        camera.position.z = targetZ;
        
        if (progress >= 1) {
          isResetting.current = false;
          userInteracting.current = false;
          resetStartTimeRef.current = 0;
        }
      }
      // Auto-rotate when no selection and user not interacting
      else if (!selectedCountry && !userInteracting.current) {
        currentRotation.current.y += delta * 0.08;
        
        // Smooth zoom to default
        const currentZ = camera.position.z;
        const diff = targetZoom.current - currentZ;
        camera.position.z = currentZ + diff * 0.04;
      } 
      // Animate to selected country
      else if (selectedCountry && !userInteracting.current) {
        // Smooth rotation to target
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
        
        // Smooth zoom
        const currentZ = camera.position.z;
        const diff = targetZoom.current - currentZ;
        camera.position.z = currentZ + diff * 0.04;
      }
      
      // Apply rotation
      earthRef.current.rotation.x = currentRotation.current.x;
      earthRef.current.rotation.y = currentRotation.current.y;
    }
  });

  // Set target rotation when country is selected
  useEffect(() => {
    if (selectedCountry) {
      userInteracting.current = false;
      
      const country = WCA_COUNTRIES_MAP[selectedCountry];
      if (country) {
        // Convert lat/lng to rotation angles
        // Longitude -> Y rotation (yaw), with offset so country faces camera
        const lngRad = THREE.MathUtils.degToRad(-(country.lng + 90));
        // Latitude -> X rotation (pitch)
        const latRad = THREE.MathUtils.degToRad(country.lat);
        
        targetRotation.current.y = lngRad;
        targetRotation.current.x = latRad;
        targetZoom.current = 1.6; // Zoom in
      }
    } else if (!selectedCountry && !isResetting.current) {
      targetZoom.current = 2.8; // Zoom out to default
      targetRotation.current.x = 0;
    }
  }, [selectedCountry, targetRotation, targetZoom, userInteracting, isResetting]);

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

      <FlyingAirplanes 
        countries={countries} 
        isActive={!selectedCountry && !userInteracting.current}
      />

      <InstancedCountryMarkers
        countries={countries}
        selectedCountry={selectedCountry}
        onSelect={onCountrySelect}
      />

      {selectedCountryData && (
        <SelectionHighlight
          lat={selectedCountryData.lat}
          lng={selectedCountryData.lng}
          isVisible={true}
        />
      )}

      <CityMarkers
        partners={countryPartners}
        isVisible={!!selectedCountry}
      />
    </group>
  );
}

interface GlobeSceneProps {
  selectedCountry: string | null;
  onCountrySelect: (code: string) => void;
  countries: CountryWithPartners[];
  countryPartners: GlobePartner[];
  userInteracting: React.MutableRefObject<boolean>;
  isResetting: React.MutableRefObject<boolean>;
}

// Scene setup with lights, stars, and controls
function GlobeScene({ 
  selectedCountry, 
  onCountrySelect,
  countries,
  countryPartners,
  userInteracting,
  isResetting,
}: GlobeSceneProps) {
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

/**
 * StandaloneGlobe - A fully self-contained 3D interactive globe component
 * 
 * Features:
 * - Smooth rotation animation when selecting countries
 * - Auto-rotation when idle
 * - Interactive markers for countries with partners
 * - Aurora borealis and network connection effects
 * - Flying airplane animations
 */
export function StandaloneGlobe({ 
  selectedCountry, 
  onCountrySelect,
  countries = DEFAULT_COUNTRIES,
  countryPartners = [],
}: StandaloneGlobeProps) {
  const userInteracting = useRef(false);
  const isResetting = useRef(false);

  const handleGlobeCountrySelect = useCallback((code: string) => {
    onCountrySelect(code === selectedCountry ? null : code);
  }, [selectedCountry, onCountrySelect]);

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
        />
      </Canvas>

      {/* Minimal legend - bottom left corner */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] text-gray-400 bg-black/40 backdrop-blur-sm rounded px-2 py-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Partner</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span>Empty</span>
        </div>
      </div>
    </div>
  );
}

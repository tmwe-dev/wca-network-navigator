import { useEffect, useRef, useState, useCallback } from "react";
import Globe from "react-globe.gl";
import { usePartners } from "@/hooks/usePartners";

// Country coordinates for camera positioning
const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  GB: { lat: 51.5, lng: -0.1 },
  CN: { lat: 35.0, lng: 105.0 },
  NL: { lat: 52.0, lng: 5.0 },
  AE: { lat: 24.0, lng: 54.0 },
  AU: { lat: -25.0, lng: 135.0 },
  DE: { lat: 51.0, lng: 10.0 },
  SG: { lat: 1.3, lng: 103.8 },
  IT: { lat: 42.0, lng: 12.0 },
  JP: { lat: 36.0, lng: 138.0 },
  BR: { lat: -14.0, lng: -51.0 },
  US: { lat: 39.0, lng: -98.0 },
  FR: { lat: 46.0, lng: 2.0 },
  ES: { lat: 40.0, lng: -4.0 },
  IN: { lat: 20.0, lng: 78.0 },
  KR: { lat: 36.0, lng: 128.0 },
  MX: { lat: 23.0, lng: -102.0 },
  CA: { lat: 56.0, lng: -106.0 },
  RU: { lat: 61.0, lng: 105.0 },
  ZA: { lat: -30.0, lng: 25.0 },
  AR: { lat: -38.0, lng: -63.0 },
  TH: { lat: 15.0, lng: 100.0 },
  MY: { lat: 4.0, lng: 109.0 },
  ID: { lat: -5.0, lng: 120.0 },
  PH: { lat: 13.0, lng: 122.0 },
  VN: { lat: 16.0, lng: 108.0 },
  PL: { lat: 52.0, lng: 19.0 },
  TR: { lat: 39.0, lng: 35.0 },
  SA: { lat: 24.0, lng: 45.0 },
  EG: { lat: 27.0, lng: 30.0 },
  NG: { lat: 10.0, lng: 8.0 },
  KE: { lat: -1.0, lng: 38.0 },
  CL: { lat: -35.0, lng: -71.0 },
  CO: { lat: 4.0, lng: -72.0 },
  PE: { lat: -10.0, lng: -76.0 },
  NZ: { lat: -42.0, lng: 174.0 },
  HK: { lat: 22.3, lng: 114.2 },
  TW: { lat: 23.7, lng: 121.0 },
  BE: { lat: 50.5, lng: 4.5 },
  AT: { lat: 47.5, lng: 14.5 },
  CH: { lat: 47.0, lng: 8.0 },
  SE: { lat: 62.0, lng: 15.0 },
  NO: { lat: 62.0, lng: 10.0 },
  DK: { lat: 56.0, lng: 10.0 },
  FI: { lat: 64.0, lng: 26.0 },
  PT: { lat: 39.5, lng: -8.0 },
  GR: { lat: 39.0, lng: 22.0 },
  CZ: { lat: 50.0, lng: 15.5 },
  HU: { lat: 47.0, lng: 20.0 },
  RO: { lat: 46.0, lng: 25.0 },
  UA: { lat: 49.0, lng: 32.0 },
  IL: { lat: 31.0, lng: 35.0 },
  PK: { lat: 30.0, lng: 69.0 },
  BD: { lat: 24.0, lng: 90.0 },
  LK: { lat: 7.0, lng: 81.0 },
};

interface CampaignGlobeProps {
  selectedCountry: string | null;
  onCountrySelect: (countryCode: string | null) => void;
}

export function CampaignGlobe({ selectedCountry, onCountrySelect }: CampaignGlobeProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<any>({ features: [] });
  const [hoverCountry, setHoverCountry] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { data: partners } = usePartners();

  // Get countries that have partners
  const countriesWithPartners = new Set(partners?.map(p => p.country_code) || []);

  // Load country GeoJSON
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson")
      .then((res) => res.json())
      .then(setCountries);
  }, []);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);

  // Rotate to selected country
  useEffect(() => {
    if (selectedCountry && globeRef.current) {
      const coords = COUNTRY_COORDS[selectedCountry];
      if (coords) {
        globeRef.current.pointOfView(
          { lat: coords.lat, lng: coords.lng, altitude: 1.5 },
          1000
        );
      }
    }
  }, [selectedCountry]);

  // Initial globe position
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 30, lng: 0, altitude: 2.2 }, 0);
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.3;
    }
  }, []);

  const handlePolygonClick = useCallback((polygon: any) => {
    const countryCode = polygon?.properties?.ISO_A2;
    if (countryCode && countriesWithPartners.has(countryCode)) {
      // Stop auto-rotation when user clicks
      if (globeRef.current) {
        globeRef.current.controls().autoRotate = false;
      }
      onCountrySelect(countryCode === selectedCountry ? null : countryCode);
    }
  }, [onCountrySelect, selectedCountry, countriesWithPartners]);

  const getPolygonColor = useCallback((feat: any) => {
    const code = feat?.properties?.ISO_A2;
    const hasPartners = countriesWithPartners.has(code);
    
    if (code === selectedCountry) {
      return "rgba(234, 179, 8, 0.7)"; // Gold 70% transparent
    }
    if (code === hoverCountry && hasPartners) {
      return "rgba(234, 179, 8, 0.4)"; // Gold hover
    }
    if (hasPartners) {
      return "rgba(14, 165, 233, 0.6)"; // Sky blue for countries with partners
    }
    return "rgba(100, 116, 139, 0.2)"; // Gray for others
  }, [selectedCountry, hoverCountry, countriesWithPartners]);

  const getPolygonStrokeColor = useCallback((feat: any) => {
    const code = feat?.properties?.ISO_A2;
    if (code === selectedCountry) {
      return "#eab308"; // Gold border
    }
    if (countriesWithPartners.has(code)) {
      return "#0ea5e9"; // Sky blue border
    }
    return "#475569"; // Slate border
  }, [selectedCountry, countriesWithPartners]);

  const getPolygonAltitude = useCallback((feat: any) => {
    const code = feat?.properties?.ISO_A2;
    if (code === selectedCountry) return 0.04;
    if (code === hoverCountry) return 0.02;
    return 0.01;
  }, [selectedCountry, hoverCountry]);

  const handlePolygonHover = useCallback((polygon: any) => {
    const code = polygon?.properties?.ISO_A2;
    if (code && countriesWithPartners.has(code)) {
      setHoverCountry(code);
      document.body.style.cursor = "pointer";
    } else {
      setHoverCountry(null);
      document.body.style.cursor = "default";
    }
  }, [countriesWithPartners]);

  const getPolygonLabel = useCallback((feat: any) => {
    const code = feat?.properties?.ISO_A2;
    const name = feat?.properties?.ADMIN;
    if (!countriesWithPartners.has(code)) return null;
    
    const partnerCount = partners?.filter(p => p.country_code === code).length || 0;
    return `
      <div style="background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 8px; color: white;">
        <strong>${name}</strong><br/>
        <span style="color: #0ea5e9;">${partnerCount} partner${partnerCount !== 1 ? 's' : ''}</span>
      </div>
    `;
  }, [countriesWithPartners, partners]);

  return (
    <div ref={containerRef} className="w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-black rounded-lg overflow-hidden">
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          polygonsData={countries.features}
          polygonAltitude={getPolygonAltitude}
          polygonCapColor={getPolygonColor}
          polygonSideColor={() => "rgba(100, 116, 139, 0.15)"}
          polygonStrokeColor={getPolygonStrokeColor}
          polygonLabel={getPolygonLabel}
          onPolygonClick={handlePolygonClick}
          onPolygonHover={handlePolygonHover}
          atmosphereColor="#0ea5e9"
          atmosphereAltitude={0.2}
        />
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border rounded-lg p-3 text-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-sky-500/60" />
          <span>Partners disponibili</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-yellow-500/70" />
          <span>Paese selezionato</span>
        </div>
      </div>
    </div>
  );
}

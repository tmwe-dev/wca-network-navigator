import { useMemo, useState, useCallback } from "react";
import { StandaloneGlobe } from "@/standalone-globe";
import { WCA_COUNTRIES } from "@/standalone-globe/data/wcaCountries";
import type { CountryWithPartners } from "@/standalone-globe/types";

interface PartnerMiniGlobeProps {
  partnerCountryCode: string;
  partnerCity: string;
  branchCities: Array<Record<string, unknown>> | null;
}

export function PartnerMiniGlobe({ partnerCountryCode, partnerCity: _partnerCity, branchCities }: PartnerMiniGlobeProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const countries: CountryWithPartners[] = useMemo(() => {
    const codes = new Set<string>();
    codes.add(partnerCountryCode);

    const branches = Array.isArray(branchCities) ? branchCities : [];
    branches.forEach((b) => {
      const code = b?.country_code || b?.country;
      if (code) codes.add(code);
    });

    return Array.from(codes).map((code) => {
      const wca = WCA_COUNTRIES.find((c) => c.code === code);
      if (!wca) return null;
      return {
        code: wca.code,
        name: wca.name,
        count: code === partnerCountryCode ? 1 : 1,
        lat: wca.lat,
        lng: wca.lng,
        region: wca.region,
      };
    }).filter(Boolean) as CountryWithPartners[];
  }, [partnerCountryCode, branchCities]);

  const handleSelect = useCallback((code: string | null) => {
    setSelected(code);
  }, []);

  if (countries.length <= 1) return null;

  return (
    <div className="w-[200px] h-[200px] rounded-xl overflow-hidden border border-border/50 bg-[#020617]">
      <StandaloneGlobe
        selectedCountry={selected}
        onCountrySelect={handleSelect}
        countries={countries}
        countryPartners={[]}
      />
    </div>
  );
}

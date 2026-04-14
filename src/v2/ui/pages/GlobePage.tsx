/**
 * GlobePage V2 — Standalone 3D globe showing WCA partner network.
 * Does NOT wrap SuperHome3D (which is the V1 dashboard with redirect).
 */
import * as React from "react";
import { Suspense, lazy, useState, useCallback } from "react";

const CampaignGlobe = lazy(() =>
  import("@/components/campaigns/CampaignGlobe").then((m) => ({
    default: m.CampaignGlobe,
  }))
);

export function GlobePage(): React.ReactElement {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const handleCountrySelect = useCallback((code: string | null) => {
    setSelectedCountry(code);
  }, []);

  return (
    <div className="h-full w-full relative">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <CampaignGlobe
          selectedCountry={selectedCountry}
          onCountrySelect={handleCountrySelect}
        />
      </Suspense>
    </div>
  );
}

/**
 * GlobePage — 3D interactive globe with partner data
 */
import * as React from "react";
import { Suspense, lazy, useState } from "react";
import { useCountryStatsV2 } from "@/v2/hooks/useCountryStatsV2";

const StandaloneGlobe = lazy(() =>
  import("@/standalone-globe").then((m) => ({ default: m.StandaloneGlobe }))
);

export function GlobePage(): React.ReactElement {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const { data: countryStats } = useCountryStatsV2();

  const totalPartners = countryStats?.reduce((s, c) => s + c.count, 0) ?? 0;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-card">
        <h1 className="text-xl font-bold text-foreground">Mappa Globale</h1>
        <p className="text-xs text-muted-foreground">
          {countryStats?.length ?? 0} paesi • {totalPartners} partner
        </p>
      </div>
      <div className="flex-1 relative bg-background">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }>
          <StandaloneGlobe selectedCountry={selectedCountry} onCountrySelect={setSelectedCountry} />
        </Suspense>
      </div>
    </div>
  );
}

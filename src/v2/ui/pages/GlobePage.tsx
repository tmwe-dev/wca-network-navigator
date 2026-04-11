/**
 * GlobePage — 3D interactive globe with partner data
 */
import * as React from "react";
import { Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StandaloneGlobe = lazy(() =>
  import("@/standalone-globe").then((m) => ({ default: m.StandaloneGlobe }))
);

export function GlobePage(): React.ReactElement {
  const { data: countryStats } = useQuery({
    queryKey: ["v2-country-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_country_stats");
      if (error) throw error;
      return data ?? [];
    },
  });

  const partners = (countryStats ?? []).map((s) => ({
    id: s.country_code,
    name: s.country_code,
    country: s.country_code,
    lat: 0,
    lng: 0,
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-card">
        <h1 className="text-xl font-bold text-foreground">Mappa Globale</h1>
        <p className="text-xs text-muted-foreground">
          {countryStats?.length ?? 0} paesi • {countryStats?.reduce((s, c) => s + Number(c.total_partners), 0) ?? 0} partner
        </p>
      </div>
      <div className="flex-1 relative bg-background">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }>
          <StandaloneGlobe partners={partners} />
        </Suspense>
      </div>
    </div>
  );
}

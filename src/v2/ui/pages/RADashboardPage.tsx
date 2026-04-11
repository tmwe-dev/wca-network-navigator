/**
 * RADashboardPage — Research & Analysis dashboard with stats and navigation
 */
import * as React from "react";
import { useDownloadJobsV2 } from "@/v2/hooks/useDownloadJobsV2";
import { BarChart3, Globe, Download, Search, ArrowRight } from "lucide-react";
import { StatCard } from "../molecules/StatCard";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export function RADashboardPage(): React.ReactElement {
  const navigate = useNavigate();

  const { data: dirCache } = useQuery({
    queryKey: ["v2", "directory-cache"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directory_cache")
        .select("id, country_code, network_name, total_results, download_verified, scanned_at")
        .order("scanned_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: jobs } = useDownloadJobsV2();

  const totalScanned = dirCache?.reduce((s, d) => s + d.total_results, 0) ?? 0;
  const verified = dirCache?.filter((d) => d.download_verified).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />Research & Analysis
          </h1>
          <p className="text-sm text-muted-foreground">Dashboard ricerca, scraping e analisi dati.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/v2/ra-explorer")} className="gap-1.5">
            <Search className="h-4 w-4" />Explorer
          </Button>
          <Button variant="outline" onClick={() => navigate("/v2/ra-scraping")} className="gap-1.5">
            <Download className="h-4 w-4" />Scraping
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Paesi scansionati" value={String(dirCache?.length ?? 0)} icon={<Globe className="h-4 w-4" />} />
        <StatCard title="Risultati totali" value={totalScanned.toLocaleString()} icon={<Search className="h-4 w-4" />} />
        <StatCard title="Verificati" value={String(verified)} icon={<Download className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="cache">
        <TabsList>
          <TabsTrigger value="cache" className="gap-1.5"><Globe className="h-3.5 w-3.5" />Directory Cache</TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5"><Download className="h-3.5 w-3.5" />Download Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="cache" className="mt-4">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Paese</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Network</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Risultati</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Verificato</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Scansione</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground w-16" />
                </tr>
              </thead>
              <tbody>
                {dirCache?.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2 text-foreground font-medium">{d.country_code}</td>
                    <td className="px-4 py-2 text-muted-foreground">{d.network_name}</td>
                    <td className="px-4 py-2 text-foreground">{d.total_results}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={d.download_verified ? "success" : "neutral"} label={d.download_verified ? "Verificato" : "Non verificato"} />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(d.scanned_at).toLocaleDateString("it")}</td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/v2/ra-explorer?country=${d.country_code}`)}>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <div className="space-y-3">
            {jobs?.map((j) => (
              <div key={j.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{j.countryName}</p>
                  <p className="text-xs text-muted-foreground">{j.currentIndex}/{j.totalCount} • {j.contactsFoundCount} contatti trovati</p>
                </div>
                <StatusBadge
                  status={j.status === "completed" ? "success" : j.status === "running" ? "info" : "warning"}
                  label={j.status}
                />
              </div>
            )) ?? null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

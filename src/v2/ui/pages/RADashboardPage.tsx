/**
 * RADashboardPage — Research & Analysis dashboard
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Globe, Download, Search } from "lucide-react";
import { StatCard } from "../molecules/StatCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function RADashboardPage(): React.ReactElement {
  const { data: dirCache } = useQuery({
    queryKey: ["v2-directory-cache"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directory_cache")
        .select("id, country_code, network_name, total_results, download_verified, scanned_at")
        .order("scanned_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: jobs } = useQuery({
    queryKey: ["v2-download-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("download_jobs")
        .select("id, country_name, status, total_count, current_index, contacts_found_count, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalScanned = dirCache?.reduce((s, d) => s + d.total_results, 0) ?? 0;
  const verified = dirCache?.filter((d) => d.download_verified).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BarChart3 className="h-6 w-6" />Research & Analysis</h1>
        <p className="text-sm text-muted-foreground">Dashboard ricerca, scraping e analisi dati.</p>
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
                </tr>
              </thead>
              <tbody>
                {dirCache?.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-2 text-foreground">{d.country_code}</td>
                    <td className="px-4 py-2 text-muted-foreground">{d.network_name}</td>
                    <td className="px-4 py-2 text-foreground">{d.total_results}</td>
                    <td className="px-4 py-2">{d.download_verified ? "✅" : "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(d.scanned_at).toLocaleDateString("it")}</td>
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
                  <p className="text-sm font-medium text-foreground">{j.country_name}</p>
                  <p className="text-xs text-muted-foreground">{j.current_index}/{j.total_count} • {j.contacts_found_count} contatti trovati</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${j.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : j.status === "running" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                  {j.status}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

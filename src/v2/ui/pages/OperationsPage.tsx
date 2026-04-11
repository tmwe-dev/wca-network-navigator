/**
 * OperationsPage — Batch operations management
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cog, Globe, Download } from "lucide-react";
import { StatCard } from "../molecules/StatCard";
import { StatusBadge } from "../atoms/StatusBadge";

export function OperationsPage(): React.ReactElement {
  const { data: downloadQueue } = useQuery({
    queryKey: ["v2-download-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("download_queue")
        .select("id, country_code, country_name, network_name, status, total_processed, total_found, priority")
        .order("priority", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pending = downloadQueue?.filter((q) => q.status === "pending").length ?? 0;
  const processing = downloadQueue?.filter((q) => q.status === "processing").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Cog className="h-6 w-6" />Operazioni</h1>
        <p className="text-sm text-muted-foreground">Gestione operazioni batch e code di download.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="In coda" value={String(pending)} icon={<Download className="h-4 w-4" />} />
        <StatCard title="In elaborazione" value={String(processing)} icon={<Cog className="h-4 w-4" />} />
        <StatCard title="Totale operazioni" value={String(downloadQueue?.length ?? 0)} icon={<Globe className="h-4 w-4" />} />
      </div>

      {downloadQueue && downloadQueue.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Paese</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Network</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Progresso</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Priorità</th>
              </tr>
            </thead>
            <tbody>
              {downloadQueue.map((q) => (
                <tr key={q.id} className="border-t">
                  <td className="px-4 py-2 text-foreground">{q.country_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{q.network_name}</td>
                  <td className="px-4 py-2 text-foreground">{q.total_processed}/{q.total_found}</td>
                  <td className="px-4 py-2">
                    <StatusBadge
                      status={q.status === "completed" ? "success" : q.status === "processing" ? "info" : "warning"}
                      label={q.status}
                    />
                  </td>
                  <td className="px-4 py-2 text-foreground">{q.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

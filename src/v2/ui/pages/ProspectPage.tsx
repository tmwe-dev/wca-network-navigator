/**
 * ProspectPage — Prospect pipeline center
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Target, Search } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../atoms/StatusBadge";

const STATUS_ORDER = ["new", "contacted", "in_progress", "negotiation", "converted", "lost"] as const;
const STATUS_LABELS: Record<string, string> = {
  new: "Nuovo", contacted: "Contattato", in_progress: "In corso",
  negotiation: "Trattativa", converted: "Cliente", lost: "Perso",
};

export function ProspectPage(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["v2-prospects", statusFilter, search],
    queryFn: async () => {
      let q = supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, lead_status, country, origin, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("lead_status", statusFilter);
      if (search) q = q.or(`name.ilike.%${search}%,company_name.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Target className="h-6 w-6" />Prospect Center</h1>
        <p className="text-sm text-muted-foreground">Pipeline acquisizione contatti.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter("all")} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>Tutti</button>
        {STATUS_ORDER.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Cerca contatto..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Caricamento...</p> : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Azienda</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Paese</th>
              </tr>
            </thead>
            <tbody>
              {contacts?.map((c) => (
                <tr key={c.id} className="border-t hover:bg-accent/30">
                  <td className="px-4 py-2 text-foreground">{c.name ?? "—"}</td>
                  <td className="px-4 py-2 text-foreground">{c.company_name ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{c.email ?? "—"}</td>
                  <td className="px-4 py-2"><StatusBadge status={c.lead_status === "converted" ? "success" : c.lead_status === "lost" ? "error" : "info"} label={STATUS_LABELS[c.lead_status] ?? c.lead_status} /></td>
                  <td className="px-4 py-2 text-muted-foreground">{c.country ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

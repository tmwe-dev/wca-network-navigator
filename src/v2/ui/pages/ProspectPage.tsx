/**
 * ProspectPage — Pipeline view with status columns and contact actions
 */
import * as React from "react";
import { useState, useMemo } from "react";
import { useProspectPipelineV2 } from "@/v2/hooks/useProspectPipelineV2";
import { Target, Search, Mail, Phone } from "lucide-react";
import { Button } from "../atoms/Button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const STATUS_ORDER = ["new", "contacted", "in_progress", "negotiation", "converted", "lost"] as const;
const STATUS_LABELS: Record<string, string> = {
  new: "Nuovo", contacted: "Contattato", in_progress: "In corso",
  negotiation: "Trattativa", converted: "Cliente", lost: "Perso",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500", contacted: "bg-amber-500", in_progress: "bg-purple-500",
  negotiation: "bg-orange-500", converted: "bg-green-500", lost: "bg-muted",
};

export function ProspectPage(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: contacts, isLoading } = useProspectPipelineV2(
    statusFilter !== "all" ? statusFilter : undefined,
    search || undefined,
  );

  const statusCounts = useMemo(() => {
    if (!contacts) return {};
    const counts: Record<string, number> = {};
    for (const c of contacts) {
      counts[c.leadStatus] = (counts[c.leadStatus] ?? 0) + 1;
    }
    return counts;
  }, [contacts]);

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("imported_contacts").update({ lead_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "prospect-pipeline"] });
      toast.success("Stato aggiornato");
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Target className="h-6 w-6" />Prospect Center</h1>
        <p className="text-sm text-muted-foreground">Pipeline acquisizione contatti.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter("all")} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
          Tutti ({contacts?.length ?? 0})
        </button>
        {STATUS_ORDER.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
            <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[s]}`} />
            {STATUS_LABELS[s]} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Cerca contatto..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-2">
          {contacts?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
              <div className={`h-8 w-1 rounded-full ${STATUS_COLORS[c.leadStatus] ?? "bg-muted"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name ?? c.companyName ?? "—"}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {c.companyName && c.name ? <span className="truncate">{c.companyName}</span> : null}
                  {c.country ? <span>{c.country}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {c.email ? (
                  <Button variant="ghost" size="sm" onClick={() => navigate("/v2/email-composer", { state: { prefilledRecipient: { email: c.email, name: c.name } } })}>
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                {(c.phone ?? c.mobile) ? (
                  <Button variant="ghost" size="sm" onClick={() => { const num = c.phone ?? c.mobile; if (num) window.open(`tel:${num}`); }}>
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <select
                  className="rounded border bg-background px-1.5 py-0.5 text-xs text-foreground"
                  value={c.leadStatus}
                  onChange={(e) => updateStatusMut.mutate({ id: c.id, status: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                >
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
          ))}
          {contacts?.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nessun prospect trovato</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

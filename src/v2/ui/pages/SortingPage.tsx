/**
 * SortingPage — Sorting rules management
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpDown } from "lucide-react";
import { EmptyState } from "../atoms/EmptyState";

export function SortingPage(): React.ReactElement {
  const { data: rules, isLoading } = useQuery({
    queryKey: ["v2-sorting-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_playbooks")
        .select("id, name, code, category, priority, is_active, description")
        .order("priority", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><ArrowUpDown className="h-6 w-6" />Ordinamento</h1>
        <p className="text-sm text-muted-foreground">Regole di ordinamento e playbook commerciali.</p>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Caricamento...</p> : rules && rules.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Codice</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Categoria</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Priorità</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Attivo</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 text-foreground font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                  <td className="px-4 py-2 text-foreground">{r.priority}</td>
                  <td className="px-4 py-2">{r.is_active ? "✅" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Nessuna regola" description="Le regole di ordinamento verranno visualizzate qui." />
      )}
    </div>
  );
}

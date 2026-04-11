/**
 * SortingPage — Sorting rules management with CRUD and toggle
 */
import * as React from "react";
import { useSortingV2 } from "@/v2/hooks/useSortingV2";
import { ArrowUpDown } from "lucide-react";
import { EmptyState } from "../atoms/EmptyState";
import { Button } from "../atoms/Button";
import { StatusBadge } from "../atoms/StatusBadge";

export function SortingPage(): React.ReactElement {
  const { data: rules, isLoading, toggleRule } = useSortingV2();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ArrowUpDown className="h-6 w-6" />Ordinamento
        </h1>
        <p className="text-sm text-muted-foreground">Regole di ordinamento e playbook commerciali.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rules && rules.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Campo</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Direzione</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Priorità</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-2 text-foreground font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{r.field}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.direction}</td>
                  <td className="px-4 py-2 text-foreground">{r.priority}</td>
                  <td className="px-4 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRule({ id: r.id, isActive: !r.isActive })}
                    >
                      <StatusBadge
                        status={r.isActive ? "success" : "neutral"}
                        label={r.isActive ? "Attivo" : "Inattivo"}
                      />
                    </Button>
                  </td>
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

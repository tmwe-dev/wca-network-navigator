/**
 * OperatorsSettingsTab — Operators management
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FormSection } from "../../organisms/FormSection";
import { Loader2, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

export function OperatorsSettingsTab(): React.ReactElement {
  const qc = useQueryClient();

  const { data: operators, isLoading } = useQuery({
    queryKey: queryKeys.v2.operators,
    queryFn: async () => {
      const { data } = await supabase
        .from("operators")
        .select("id, name, email, is_active, is_admin, created_at")
        .order("name");
      return data ?? [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("operators")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.v2.operators });
      toast.success("Operatore aggiornato");
    },
  });

  return (
    <div className="space-y-6">
      <FormSection title="Operatori" description="Gestione degli operatori della piattaforma.">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !operators || operators.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessun operatore configurato.</p>
        ) : (
          <div className="space-y-2">
            {operators.map((op) => (
              <div key={op.id} className="flex items-center gap-3 p-3 rounded-md border">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{op.name}</p>
                  <p className="text-xs text-muted-foreground">{op.email} · {op.is_admin ? "Admin" : "Operatore"}</p>
                </div>
                <Switch
                  checked={op.is_active}
                  onCheckedChange={(v) => toggleMutation.mutate({ id: op.id, isActive: v })}
                />
              </div>
            ))}
          </div>
        )}
      </FormSection>
    </div>
  );
}

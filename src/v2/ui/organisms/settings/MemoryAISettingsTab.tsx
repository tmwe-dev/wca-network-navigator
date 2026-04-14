/**
 * MemoryAISettingsTab — AI memory dashboard
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FormSection } from "../../organisms/FormSection";
import { Button } from "@/components/ui/button";
import { Loader2, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

export function MemoryAISettingsTab(): React.ReactElement {
  const qc = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.v2.aiMemoryStats,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { total: 0, episodic: 0, semantic: 0 };
      const { data } = await supabase
        .from("ai_memory")
        .select("memory_type")
        .eq("user_id", user.id);
      const items = data ?? [];
      return {
        total: items.length,
        episodic: items.filter((m) => m.memory_type === "episodic").length,
        semantic: items.filter((m) => m.memory_type === "semantic").length,
      };
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      const { error } = await supabase
        .from("ai_memory")
        .delete()
        .eq("user_id", user.id)
        .eq("memory_type", "episodic");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.v2.aiMemoryStats });
      toast.success("Memorie episodiche cancellate");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <FormSection title="Memoria AI" description="Gestione delle memorie degli agenti AI.">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-md border text-center">
                <Database className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold text-foreground">{stats?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Totale</p>
              </div>
              <div className="p-3 rounded-md border text-center">
                <p className="text-lg font-bold text-foreground">{stats?.episodic ?? 0}</p>
                <p className="text-xs text-muted-foreground">Episodiche</p>
              </div>
              <div className="p-3 rounded-md border text-center">
                <p className="text-lg font-bold text-foreground">{stats?.semantic ?? 0}</p>
                <p className="text-xs text-muted-foreground">Semantiche</p>
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reset memorie episodiche
            </Button>
          </div>
        )}
      </FormSection>
    </div>
  );
}

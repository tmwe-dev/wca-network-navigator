import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type OperatorRow = Database["public"]["Tables"]["operators"]["Row"];
type OperatorInsert = Database["public"]["Tables"]["operators"]["Insert"];
type OperatorUpdate = Database["public"]["Tables"]["operators"]["Update"];

export type Operator = OperatorRow;

export function useOperators() {
  return useQuery({
    queryKey: ["operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCurrentOperator() {
  return useQuery({
    queryKey: ["current-operator"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (op: Partial<Operator> & { id?: string }) => {
      if (op.id) {
        const { id, ...rest } = op;
        const { error } = await supabase
          .from("operators")
          .update(rest as OperatorUpdate)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("operators")
          .insert(op as OperatorInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operators"] });
      qc.invalidateQueries({ queryKey: ["current-operator"] });
      toast.success("Operatore salvato");
    },
    onError: (e: Error) => toast.error("Errore: " + e.message),
  });
}

export function useDeleteOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("operators")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operators"] });
      toast.success("Operatore eliminato");
    },
    onError: (e: Error) => toast.error("Errore: " + e.message),
  });
}

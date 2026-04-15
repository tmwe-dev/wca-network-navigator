import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/AuthProvider";

type OperatorRow = Database["public"]["Tables"]["operators"]["Row"];
type OperatorInsert = Database["public"]["Tables"]["operators"]["Insert"];
type OperatorUpdate = Database["public"]["Tables"]["operators"]["Update"];

export type Operator = OperatorRow;

export function useOperators() {
  const { status } = useAuth();

  return useQuery({
    queryKey: queryKeys.operators.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: status === "authenticated",
  });
}

export function useCurrentOperator() {
  const { status } = useAuth();

  return useQuery({
    queryKey: queryKeys.operators.current,
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
    enabled: status === "authenticated",
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
      qc.invalidateQueries({ queryKey: queryKeys.operators.all });
      qc.invalidateQueries({ queryKey: queryKeys.operators.current });
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
      qc.invalidateQueries({ queryKey: queryKeys.operators.all });
      toast.success("Operatore eliminato");
    },
    onError: (e: Error) => toast.error("Errore: " + e.message),
  });
}

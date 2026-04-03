import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Operator = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
  imap_host: string | null;
  imap_user: string | null;
  smtp_host: string | null;
  smtp_user: string | null;
  smtp_port: number | null;
  whatsapp_phone: string | null;
  linkedin_profile_url: string | null;
  is_admin: boolean;
  is_active: boolean;
  invited_by: string | null;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useOperators() {
  return useQuery({
    queryKey: ["operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators" as any)
        .select("id, user_id, name, email, avatar_url, imap_host, imap_user, smtp_host, smtp_user, smtp_port, whatsapp_phone, linkedin_profile_url, is_admin, is_active, invited_by, invited_at, created_at, updated_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Operator[];
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
        .from("operators" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Operator | null;
    },
  });
}

export function useUpsertOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (op: Partial<Operator> & { id?: string }) => {
      if (op.id) {
        const { error } = await supabase
          .from("operators" as any)
          .update(op as any)
          .eq("id", op.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("operators" as any)
          .insert([op] as any);
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
        .from("operators" as any)
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

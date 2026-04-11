/**
 * useSortingV2 — Sorting rules CRUD
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SortingRule {
  readonly id: string;
  readonly name: string;
  readonly field: string;
  readonly direction: string;
  readonly priority: number;
  readonly isActive: boolean;
}

export function useSortingV2() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["v2", "sorting-rules"],
    queryFn: async (): Promise<readonly SortingRule[]> => {
      const { data, error } = await supabase
        .from("email_address_rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.display_name ?? r.email_address,
        field: r.email_address,
        direction: r.category ?? "default",
        priority: 0,
        isActive: true,
      }));
    },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await supabase.from("email_address_rules").update({ category: isActive ? "active" : "inactive" }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "sorting-rules"] }),
  });

  return { ...query, toggleRule: toggleMut.mutate };
}

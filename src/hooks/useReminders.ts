import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Reminder {
  id: string;
  partner_id: string;
  due_date: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
  partners?: {
    company_name: string;
    country_code: string;
  };
}

export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select(`
          *,
          partners (company_name, country_code)
        `)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Reminder[];
    },
  });
}

export function usePendingReminders() {
  return useQuery({
    queryKey: ["reminders", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select(`
          *,
          partners (company_name, country_code)
        `)
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data as Reminder[];
    },
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reminders")
        .update({ status: "completed" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

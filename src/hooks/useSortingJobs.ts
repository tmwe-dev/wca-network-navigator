import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("useSortingJobs");

type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];
type _InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];

export interface SortingJob {
  id: string;
  partner_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  email_subject: string | null;
  email_body: string | null;
  scheduled_at: string | null;
  reviewed: boolean;
  sent_at: string | null;
  status: string;
  created_at: string;
  selected_contact_id: string | null;
  campaign_batch_id: string | null;
  partners: {
    company_name: string;
    company_alias: string | null;
    country_code: string;
    country_name: string;
    city: string;
    logo_url: string | null;
  } | null;
  selected_contact: {
    id: string;
    name: string;
    email: string | null;
    contact_alias: string | null;
  } | null;
}

export function useSortingJobs() {
  return useQuery({
    queryKey: queryKeys.sorting.jobs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          id, partner_id, activity_type, title, description,
          email_subject, email_body, scheduled_at, reviewed, sent_at,
          status, created_at, selected_contact_id, campaign_batch_id,
          partners(company_name, company_alias, country_code, country_name, city, logo_url),
          selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, contact_alias)
        `)
        .eq("status", "pending")
        .not("email_body", "is", null)
        .is("campaign_batch_id", null)
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as SortingJob[];
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useReviewJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reviewed }: { id: string; reviewed: boolean }) => {
      const { error } = await supabase
        .from("activities")
        .update({ reviewed } satisfies ActivityUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs }),
  });
}

export function useBulkReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("activities")
        .update({ reviewed: true } satisfies ActivityUpdate)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs });
      toast.success("Job approvati");
    },
  });
}

export function useCancelJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("activities")
        .update({ status: "cancelled" } satisfies ActivityUpdate)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
      toast.success("Job scartati");
    },
  });
}

export function useSendJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (job: SortingJob) => {
      const email = job.selected_contact?.email;
      if (!email) throw new Error("Nessuna email per questo contatto");
      if (!job.email_subject || !job.email_body) throw new Error("Subject o body mancante");

      // SSOT v3.9.56: enqueue in ai_pending_actions; dispatch reale via useApproveAndDispatch.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Sessione non valida");

      const { error } = await supabase.from("ai_pending_actions").insert({
        user_id: userId,
        action_type: "send_email",
        action_payload: {
          to: email,
          subject: job.email_subject,
          html: job.email_body,
          body: job.email_body,
          partner_id: job.partner_id,
          contact_id: job.selected_contact_id,
          activity_id: job.id,
        } as never,
        partner_id: job.partner_id,
        contact_id: job.selected_contact_id,
        email_address: email,
        suggested_content: job.email_body,
        reasoning: "Sorting job: email pronta, in attesa di approvazione.",
        confidence: 1.0,
        source: "useSortingJobs.useSendJob",
        status: "pending",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
      qc.invalidateQueries({ queryKey: queryKeys.activities.workedToday });
      qc.invalidateQueries({ queryKey: queryKeys.partners.all });
      toast.success("📥 Email in coda di approvazione");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateJobEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, email_subject, email_body }: { id: string; email_subject: string; email_body: string }) => {
      const { error } = await supabase
        .from("activities")
        .update({ email_subject, email_body } satisfies ActivityUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs });
      toast.success("Email aggiornata");
    },
  });
}

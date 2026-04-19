import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { updatePartner } from "@/data/partners";
import { createInteraction } from "@/data/interactions";
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

      const data = await invokeEdge<{ error?: string }>("send-email", {
        body: {
          to: email,
          subject: job.email_subject,
          html: job.email_body,
          partner_id: job.partner_id,
        },
        context: "useSortingJobs.sendEmail",
      });
      if (data?.error) throw new Error(data.error);

      const now = new Date().toISOString();
      // Update activity status
      const { error } = await supabase
        .from("activities")
        .update({
          status: "completed",
          sent_at: now,
          completed_at: now,
        } satisfies ActivityUpdate)
        .eq("id", job.id);
      if (error) throw error;

      // Update partner lead_status and last_interaction_at
      if (job.partner_id) {
        // Conditional update: only escalate if currently "new" → "first_touch_sent"
        await updatePartner(job.partner_id, { lead_status: "first_touch_sent", last_interaction_at: now });

        // Create interaction record
        await createInteraction({
          partner_id: job.partner_id,
          interaction_type: "email",
          subject: job.email_subject || "Email inviata",
          notes: `Inviata a ${email}`,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sorting.jobs });
      qc.invalidateQueries({ queryKey: queryKeys.activities.allActivities });
      qc.invalidateQueries({ queryKey: queryKeys.activities.workedToday });
      qc.invalidateQueries({ queryKey: queryKeys.partners.all });
      toast.success("Email inviata");
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

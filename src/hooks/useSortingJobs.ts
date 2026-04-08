import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";

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
    queryKey: ["sorting-jobs"],
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
        .update({ reviewed } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sorting-jobs"] }),
  });
}

export function useBulkReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("activities")
        .update({ reviewed: true } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorting-jobs"] });
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
        .update({ status: "cancelled" } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorting-jobs"] });
      qc.invalidateQueries({ queryKey: ["all-activities"] });
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
        } as any)
        .eq("id", job.id);
      if (error) throw error;

      // Update partner lead_status and last_interaction_at
      if (job.partner_id) {
        await supabase
          .from("partners")
          .update({
            lead_status: "contacted",
            last_interaction_at: now,
          } as any)
          .eq("id", job.partner_id)
          .eq("lead_status", "new");

        // Create interaction record
        await supabase.from("interactions").insert({
          partner_id: job.partner_id,
          interaction_type: "email" as any,
          subject: job.email_subject || "Email inviata",
          notes: `Inviata a ${email}`,
        } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorting-jobs"] });
      qc.invalidateQueries({ queryKey: ["all-activities"] });
      qc.invalidateQueries({ queryKey: ["worked-today"] });
      qc.invalidateQueries({ queryKey: ["partners"] });
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
        .update({ email_subject, email_body } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorting-jobs"] });
      toast.success("Email aggiornata");
    },
  });
}

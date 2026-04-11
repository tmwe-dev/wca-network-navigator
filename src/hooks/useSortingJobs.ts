import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { updatePartner } from "@/data/partners";
import { createInteraction } from "@/data/interactions";

const log = createLogger("useSortingJobs");

type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];
type InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];

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

function isMockEnabled(): boolean {
  try { return localStorage.getItem("demo-data-enabled") === "true"; } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return false; }
}

const MOCK_SORTING: SortingJob[] = [
  { id: "mock-sj-1", partner_id: "mock-p1", activity_type: "send_email", title: "Email primo contatto — Mazzetti Trasporti", description: "Presentazione servizi consolidato aereo MXP-DXB", email_subject: "Collaborazione Aereo MXP–DXB", email_body: "<p>Gentile Sig. Rossi,</p><p>Le scrivo per presentare le nostre tariffe consolidate sulla rotta MXP-DXB.</p><p>Cordiali saluti</p>", scheduled_at: "2026-04-09T10:00:00Z", reviewed: false, sent_at: null, status: "pending", created_at: "2026-04-08T09:00:00Z", selected_contact_id: null, campaign_batch_id: null, partners: { company_name: "Mazzetti Trasporti Srl", company_alias: null, country_code: "IT", country_name: "Italy", city: "Milano", logo_url: null }, selected_contact: { id: "mc1", name: "Marco Rossi", email: "m.rossi@mazzetti.it", contact_alias: null } },
  { id: "mock-sj-2", partner_id: "mock-p2", activity_type: "send_email", title: "Proposta mare — Global Freight", description: "Tariffe FCL Dubai-Genova Q2", email_subject: "Tariffe FCL DXB-GOA Q2 2026", email_body: "<p>Dear Ahmed,</p><p>Please find our best Q2 rates for FCL DXB–Genova.</p><p>Best regards</p>", scheduled_at: "2026-04-09T14:00:00Z", reviewed: true, sent_at: null, status: "pending", created_at: "2026-04-07T14:30:00Z", selected_contact_id: null, campaign_batch_id: null, partners: { company_name: "Global Freight LLC", company_alias: null, country_code: "AE", country_name: "UAE", city: "Dubai", logo_url: null }, selected_contact: { id: "mc2", name: "Ahmed Khan", email: "ops@globalfreight.ae", contact_alias: null } },
  { id: "mock-sj-3", partner_id: "mock-p3", activity_type: "send_email", title: "Follow-up — Pacifica Logistica", description: "Secondo contatto dopo mancata risposta", email_subject: "Re: Tariffe Mare Santos–Genova", email_body: "<p>Caro Carlos,</p><p>Non ho ricevuto riscontro alla mia precedente. Rinnovo la proposta...</p>", scheduled_at: "2026-04-10T09:00:00Z", reviewed: false, sent_at: null, status: "pending", created_at: "2026-04-08T11:15:00Z", selected_contact_id: null, campaign_batch_id: null, partners: { company_name: "Pacifica Logistica SA", company_alias: null, country_code: "BR", country_name: "Brazil", city: "São Paulo", logo_url: null }, selected_contact: { id: "mc3", name: "Carlos Silva", email: "carlos@pacifica.com.br", contact_alias: null } },
  { id: "mock-sj-4", partner_id: "mock-p4", activity_type: "send_email", title: "Proposta aereo — Nordic Shipping", description: "Consolidato aereo GOT-PVG", email_subject: "Air Consolidation GOT–PVG", email_body: "<p>Hi Erik,</p><p>We have competitive rates on the GOT–PVG air lane...</p>", scheduled_at: null, reviewed: false, sent_at: null, status: "pending", created_at: "2026-04-06T08:00:00Z", selected_contact_id: null, campaign_batch_id: null, partners: { company_name: "Nordic Shipping AB", company_alias: null, country_code: "SE", country_name: "Sweden", city: "Göteborg", logo_url: null }, selected_contact: { id: "mc4", name: "Erik Johansson", email: "info@nordicship.se", contact_alias: null } },
  { id: "mock-sj-5", partner_id: "mock-p5", activity_type: "send_email", title: "Intro — Yangtze Express", description: "Primo contatto Shanghai", email_subject: "Partnership proposal — WCA member", email_body: "<p>Dear Wang Li,</p><p>As fellow WCA members, we'd like to explore cooperation on the SHA–MXP route...</p>", scheduled_at: "2026-04-11T03:00:00Z", reviewed: true, sent_at: null, status: "pending", created_at: "2026-04-07T03:45:00Z", selected_contact_id: null, campaign_batch_id: null, partners: { company_name: "Yangtze Express Co", company_alias: null, country_code: "CN", country_name: "China", city: "Shanghai", logo_url: null }, selected_contact: { id: "mc5", name: "Wang Li", email: "wang.li@yangtze-exp.cn", contact_alias: null } },
  { id: "mock-sj-6", partner_id: "mock-p6", activity_type: "send_email", title: "Tariffe groupage — TransAlp", description: "Groupage stradale IT-DE", email_subject: "Tariffe Groupage Italia–Germania", email_body: "<p>Gentile Sig. Bianchi,</p><p>Ecco le nostre tariffe groupage per la linea VRN-MUC...</p>", scheduled_at: "2026-04-09T16:00:00Z", reviewed: false, sent_at: null, status: "pending", created_at: "2026-04-08T16:20:00Z", selected_contact_id: null, campaign_batch_id: null, partners: { company_name: "TransAlp Spedizioni", company_alias: null, country_code: "IT", country_name: "Italy", city: "Verona", logo_url: null }, selected_contact: { id: "mc6", name: "Giuseppe Bianchi", email: "g.bianchi@transalp.it", contact_alias: null } },
];

export function useSortingJobs() {
  return useQuery({
    queryKey: ["sorting-jobs"],
    queryFn: async () => {
      if (isMockEnabled()) return MOCK_SORTING;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sorting-jobs"] }),
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
        .update({ status: "cancelled" } satisfies ActivityUpdate)
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
        } satisfies ActivityUpdate)
        .eq("id", job.id);
      if (error) throw error;

      // Update partner lead_status and last_interaction_at
      if (job.partner_id) {
        // Conditional update: only escalate if currently "new"
        await updatePartner(job.partner_id, { lead_status: "contacted", last_interaction_at: now });

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
        .update({ email_subject, email_body } satisfies ActivityUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sorting-jobs"] });
      toast.success("Email aggiornata");
    },
  });
}

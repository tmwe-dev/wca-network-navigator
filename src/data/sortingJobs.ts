/**
 * DAL — sorting jobs (activities con email pronta, non ancora inviate).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];

export async function findSortingJobs<T>(): Promise<T[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, partner_id, activity_type, title, description,
      email_subject, email_body, scheduled_at, reviewed, sent_at,
      status, created_at, selected_contact_id, campaign_batch_id,
      partners(company_name, company_alias, country_code, country_name, city, logo_url),
      selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, contact_alias)
    `,
    )
    .eq("status", "pending")
    .is("deleted_at", null)
    .not("email_body", "is", null)
    .is("campaign_batch_id", null)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}

export async function setActivityReviewed(id: string, reviewed: boolean): Promise<void> {
  const { error } = await supabase
    .from("activities")
    .update({ reviewed } satisfies ActivityUpdate)
    .eq("id", id);
  if (error) throw error;
}

export async function bulkReviewActivities(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("activities")
    .update({ reviewed: true } satisfies ActivityUpdate)
    .in("id", ids);
  if (error) throw error;
}

export async function cancelActivities(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("activities")
    .update({ status: "cancelled" } satisfies ActivityUpdate)
    .in("id", ids);
  if (error) throw error;
}

export async function updateActivityEmail(id: string, email_subject: string, email_body: string): Promise<void> {
  const { error } = await supabase
    .from("activities")
    .update({ email_subject, email_body } satisfies ActivityUpdate)
    .eq("id", id);
  if (error) throw error;
}

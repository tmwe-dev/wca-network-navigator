/**
 * crm.ts — Contact and campaign management tools.
 * Handles create_contact, create_campaign, schedule_email tools.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient<any>>;

export async function executeCreateContact(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    lead_status: String(args.lead_status || "new"),
    row_number: 0,
  };
  for (
    const f of [
      "name",
      "email",
      "company_name",
      "phone",
      "mobile",
      "position",
      "city",
      "country",
      "origin",
      "note",
    ]
  ) {
    if (args[f]) insertPayload[f] = String(args[f]);
  }

  const { data: logRow, error: logErr } = await supabase
    .from("import_logs")
    .insert({
      user_id: userId,
      file_name: "ai-assistant",
      total_rows: 1,
      imported_rows: 1,
      status: "completed",
    })
    .select("id")
    .single();
  if (logErr) return { error: `Import log creation failed: ${logErr.message}` };
  insertPayload.import_log_id = (logRow as Record<string, unknown>).id;

  const { data, error } = await supabase
    .from("imported_contacts")
    .insert(insertPayload)
    .select("id, name, email, company_name, lead_status")
    .single();
  if (error) return { error: error.message };
  return {
    success: true,
    contact: data,
    message: `Contatto creato: ${args.name || args.email || "N/A"}`,
  };
}

export async function executeCreateCampaign(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const channel = String(args.channel || "email");
  const { data, error } = await supabase
    .from("outreach_missions")
    .insert({
      user_id: userId,
      title: String(args.title || "Nuova campagna"),
      channel,
      status: "draft",
      target_filters: args.target_filters || {},
      ai_prompt: args.ai_prompt ? String(args.ai_prompt) : null,
      template_id: args.template_id ? String(args.template_id) : null,
    })
    .select("id, title, channel, status")
    .single();
  if (error) return { error: error.message };
  return {
    success: true,
    mission: data,
    message: `Campagna "${args.title}" creata in stato draft.`,
  };
}

export async function executeScheduleEmail(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const toEmail = String(args.to_email || "");
  if (!toEmail) return { error: "to_email è obbligatorio" };
  const scheduledAt = args.scheduled_at
    ? String(args.scheduled_at)
    : new Date(Date.now() + 3600_000).toISOString();
  const { data, error } = await supabase
    .from("outreach_queue")
    .insert({
      user_id: userId,
      channel: "email",
      recipient_email: toEmail,
      recipient_name: args.to_name ? String(args.to_name) : null,
      subject: String(args.subject || ""),
      body: String(args.html_body || ""),
      status: "pending",
      priority: 5,
      scheduled_at: scheduledAt,
      partner_id: args.partner_id ? String(args.partner_id) : null,
    })
    .select("id, recipient_email, subject, scheduled_at, status")
    .single();
  if (error) return { error: error.message };
  return {
    success: true,
    queued: data,
    message: `Email programmata per ${toEmail} alle ${scheduledAt}`,
  };
}

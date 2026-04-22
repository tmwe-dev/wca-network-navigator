/**
 * conversationsHistoryHandler.ts - Conversation history handler
 * Handles: get conversation history
 */

import { supabase } from "./supabaseClient.ts";

interface ChannelMessageRow {
  id: string;
  channel: string;
  direction: string;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  email_date: string;
  created_at: string;
}

async function resolvePartnerId(
  args: Record<string, unknown>
): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .eq("id", args.partner_id as string)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .ilike("company_name", `%${String(args.company_name)}%`)
      .limit(1)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  return null;
}

export async function handleGetConversationHistory(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  let pid = args.partner_id as string;
  if (!pid && args.company_name) {
    const r = await resolvePartnerId(args);
    if (r) pid = r.id;
  }
  const timeline: {
    type: string;
    direction?: string;
    subject?: string;
    from?: string;
    date: string;
    preview?: string;
    subtype?: string;
    title?: string;
    status?: string;
    notes?: string;
  }[] = [];
  if (pid) {
    const { data: emails } = await supabase
      .from("channel_messages")
      .select("id, direction, from_address, to_address, subject, body_text, email_date, channel")
      .eq("user_id", userId)
      .or(`partner_id.eq.${pid}`)
      .order("email_date", { ascending: false })
      .limit(30);
    (emails || []).forEach((e: ChannelMessageRow) =>
      timeline.push({
        type: "email",
        direction: e.direction,
        subject: e.subject ?? undefined,
        from: e.from_address ?? undefined,
        date: e.email_date || e.created_at,
        preview: e.body_text?.substring(0, 200),
      })
    );
    const { data: acts } = await supabase
      .from("activities")
      .select("id, title, activity_type, status, created_at, description")
      .or(`partner_id.eq.${pid},source_id.eq.${pid}`)
      .order("created_at", { ascending: false })
      .limit(30);
    (acts || []).forEach((a: { activity_type: string; title: string; status: string; created_at: string }) =>
      timeline.push({
        type: "activity",
        subtype: a.activity_type,
        title: a.title,
        status: a.status,
        date: a.created_at,
      })
    );
    const { data: ints } = await supabase
      .from("interactions")
      .select("id, interaction_type, subject, notes, created_at")
      .eq("partner_id", pid)
      .order("created_at", { ascending: false })
      .limit(30);
    (ints || []).forEach(
      (i: { interaction_type: string; subject: string; created_at: string }) =>
        timeline.push({
          type: "interaction",
          subtype: i.interaction_type,
          title: i.subject,
          date: i.created_at,
        })
    );
  }
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { count: timeline.length, timeline: timeline.slice(0, Number(args.limit) || 50) };
}

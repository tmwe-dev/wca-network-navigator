import type { AnySupabaseClient } from "../../_shared/supabaseClient.ts";
import { resolvePartnerId } from "../shared.ts";

interface ChannelMessageRow {
  id: string;
  channel: string;
  direction: string;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  email_date: string | null;
  read_at: string | null;
  partner_id: string | null;
  category: string | null;
  created_at: string;
  thread_id?: string | null;
  in_reply_to?: string | null;
}

interface HoldingItem {
  id: string;
  source: string;
  name: string;
  country: string;
  city?: string;
  email: string | null;
  status: string;
  days_waiting: number;
  interactions?: number;
}

export async function handleGetInbox(
  supabase: AnySupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("channel_messages")
    .select(
      "id, channel, direction, from_address, to_address, subject, body_text, email_date, read_at, partner_id, category, created_at"
    )
    .eq("user_id", userId)
    .eq("direction", "inbound")
    .order("email_date", { ascending: false })
    .limit(Math.min(Number(args.limit) || 20, 50));

  if (args.channel) {
    query = query.eq("channel", args.channel);
  }
  if (args.unread_only) {
    query = query.is("read_at", null);
  }
  if (args.partner_id) {
    query = query.eq("partner_id", args.partner_id);
  }
  if (args.from_date) {
    query = query.gte("email_date", args.from_date);
  }
  if (args.to_date) {
    query = query.lte("email_date", args.to_date);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return {
    count: data?.length || 0,
    messages: (data || []).map((m: ChannelMessageRow) => ({
      id: m.id,
      channel: m.channel,
      from: m.from_address,
      subject: m.subject,
      preview: m.body_text?.substring(0, 300) || "",
      date: m.email_date,
      read: !!m.read_at,
      partner_id: m.partner_id,
      category: m.category,
    })),
  };
}

export async function handleGetConversationHistory(
  supabase: AnySupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let pid = args.partner_id as string;

  if (!pid && args.company_name) {
    const r = await resolvePartnerId(args);
    if (r) pid = r.id;
  }

  const timeline: Record<string, unknown>[] = [];

  if (pid) {
    const { data: emails } = await supabase
      .from("channel_messages")
      .select(
        "id, direction, from_address, to_address, subject, body_text, email_date, channel"
      )
      .eq("user_id", userId)
      .or(`partner_id.eq.${pid},from_address.ilike.%${pid}%`)
      .order("email_date", { ascending: false })
      .limit(30);

    (emails || []).forEach((e: Record<string, unknown>) =>
      timeline.push({
        type: "email",
        direction: e.direction,
        subject: e.subject,
        from: e.from_address,
        date: e.email_date,
        channel: e.channel,
        preview: e.body_text?.substring(0, 200),
      })
    );

    const { data: acts } = await supabase
      .from("activities")
      .select("id, title, activity_type, status, created_at, description")
      .or(`partner_id.eq.${pid},source_id.eq.${pid}`)
      .order("created_at", { ascending: false })
      .limit(30);

    (acts || []).forEach((a: Record<string, unknown>) =>
      timeline.push({
        type: "activity",
        subtype: a.activity_type,
        title: a.title,
        status: a.status,
        date: a.created_at,
        description: a.description?.substring(0, 200),
      })
    );

    const { data: ints } = await supabase
      .from("interactions")
      .select("id, interaction_type, subject, notes, created_at")
      .eq("partner_id", pid)
      .order("created_at", { ascending: false })
      .limit(30);

    (ints || []).forEach((i: Record<string, unknown>) =>
      timeline.push({
        type: "interaction",
        subtype: i.interaction_type,
        title: i.subject,
        notes: i.notes?.substring(0, 200),
        date: i.created_at,
      })
    );

    const { data: sent } = await supabase
      .from("email_campaign_queue")
      .select("id, subject, recipient_email, status, sent_at")
      .eq("partner_id", pid)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(20);

    (sent || []).forEach((s: Record<string, unknown>) =>
      timeline.push({
        type: "email_sent",
        subject: s.subject,
        to: s.recipient_email,
        date: s.sent_at,
      })
    );
  } else if (args.contact_id) {
    const { data: cInts } = await supabase
      .from("contact_interactions")
      .select("id, interaction_type, title, description, outcome, created_at")
      .eq("contact_id", args.contact_id)
      .order("created_at", { ascending: false })
      .limit(30);

    (cInts || []).forEach((i: Record<string, unknown>) =>
      timeline.push({
        type: "interaction",
        subtype: i.interaction_type,
        title: i.title,
        description: i.description?.substring(0, 200),
        outcome: i.outcome,
        date: i.created_at,
      })
    );
  }

  timeline.sort(
    (a, b) =>
      new Date(b.date as string).getTime() -
      new Date(a.date as string).getTime()
  );

  return {
    count: timeline.length,
    timeline: timeline.slice(0, Number(args.limit) || 50),
  };
}

export async function handleGetHoldingPattern(
  supabase: AnySupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const items: HoldingItem[] = [];
  const activeStatuses = [
    "first_touch_sent",
    "holding",
    "engaged",
    "qualified",
    "negotiation",
  ];
  const now = new Date();

  if (!args.source_type || args.source_type === "wca" || args.source_type === "all") {
    let pq = supabase
      .from("partners")
      .select(
        "id, company_name, country_code, city, email, lead_status, last_interaction_at, interaction_count"
      )
      .in("lead_status", activeStatuses)
      .order("last_interaction_at", { ascending: true, nullsFirst: true });

    if (args.country_code) {
      pq = pq.eq("country_code", String(args.country_code).toUpperCase());
    }

    const { data: partners } = await pq.limit(Number(args.limit) || 50);

    (partners || []).forEach((p: Record<string, unknown>) => {
      const days = p.last_interaction_at
        ? Math.floor(
            (now.getTime() - new Date(p.last_interaction_at).getTime()) /
              86400000
          )
        : 999;

      if (args.min_days_waiting && days < Number(args.min_days_waiting))
        return;
      if (args.max_days_waiting && days > Number(args.max_days_waiting))
        return;

      items.push({
        id: p.id,
        source: "wca",
        name: p.company_name,
        country: p.country_code,
        city: p.city,
        email: p.email,
        status: p.lead_status,
        days_waiting: days,
        interactions: p.interaction_count,
      });
    });
  }

  if (
    !args.source_type ||
    args.source_type === "crm" ||
    args.source_type === "all"
  ) {
    const cq = supabase
      .from("imported_contacts")
      .select(
        "id, name, company_name, country, city, email, lead_status, last_interaction_at, interaction_count"
      )
      .in("lead_status", activeStatuses)
      .order("last_interaction_at", { ascending: true, nullsFirst: true });

    const { data: contacts } = await cq.limit(Number(args.limit) || 50);

    (contacts || []).forEach((c: Record<string, unknown>) => {
      const days = c.last_interaction_at
        ? Math.floor(
            (now.getTime() - new Date(c.last_interaction_at).getTime()) /
              86400000
          )
        : 999;

      if (args.min_days_waiting && days < Number(args.min_days_waiting))
        return;
      if (args.max_days_waiting && days > Number(args.max_days_waiting))
        return;

      items.push({
        id: c.id,
        source: "crm",
        name: c.company_name || c.name || "—",
        country: c.country,
        city: c.city,
        email: c.email,
        status: c.lead_status,
        days_waiting: days,
        interactions: c.interaction_count,
      });
    });
  }

  items.sort((a, b) => b.days_waiting - a.days_waiting);

  return {
    count: items.length,
    items: items.slice(0, Number(args.limit) || 50),
  };
}

export async function handleUpdateMessageStatus(
  supabase: AnySupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { error } = await supabase
    .from("channel_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", args.message_id)
    .eq("user_id", userId);

  return error
    ? { error: error.message }
    : { success: true, message: "Messaggio marcato come letto." };
}

export async function handleGetEmailThread(
  supabase: AnySupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let messages: ChannelMessageRow[] = [];

  if (args.thread_id) {
    const { data } = await supabase
      .from("channel_messages")
      .select(
        "id, direction, from_address, to_address, subject, body_text, email_date, channel"
      )
      .eq("user_id", userId)
      .eq("thread_id", args.thread_id)
      .order("email_date", { ascending: true });

    messages = data || [];
  }

  if (messages.length === 0 && args.partner_id) {
    const { data } = await supabase
      .from("channel_messages")
      .select(
        "id, direction, from_address, to_address, subject, body_text, email_date, channel, thread_id, in_reply_to"
      )
      .eq("user_id", userId)
      .eq("partner_id", args.partner_id)
      .eq("channel", "email")
      .order("email_date", { ascending: true })
      .limit(Number(args.limit) || 50);

    messages = data || [];
  }

  if (messages.length === 0 && args.email_address) {
    const { data } = await supabase
      .from("channel_messages")
      .select(
        "id, direction, from_address, to_address, subject, body_text, email_date, channel"
      )
      .eq("user_id", userId)
      .eq("channel", "email")
      .or(
        `from_address.ilike.%${args.email_address}%,to_address.ilike.%${args.email_address}%`
      )
      .order("email_date", { ascending: true })
      .limit(Number(args.limit) || 50);

    messages = data || [];
  }

  return {
    count: messages.length,
    thread: (messages as ChannelMessageRow[]).map((m) => ({
      id: m.id,
      direction: m.direction,
      from: m.from_address,
      to: m.to_address,
      subject: m.subject,
      preview: m.body_text?.substring(0, 500),
      date: m.email_date,
    })),
  };
}

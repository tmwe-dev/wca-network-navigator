/**
 * conversationsInboxHandler.ts - Inbox-related conversation handlers
 * Handles: get inbox, get email thread
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
  read_at: string | null;
  partner_id: string | null;
  category: string | null;
}

export async function handleGetInbox(
  args: Record<string, unknown>,
  userId: string
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
  if (args.channel) query = query.eq("channel", args.channel);
  if (args.unread_only) query = query.is("read_at", null);
  if (args.partner_id) query = query.eq("partner_id", args.partner_id);
  if (args.from_date) query = query.gte("email_date", args.from_date);
  if (args.to_date) query = query.lte("email_date", args.to_date);
  const { data, error } = await query;
  if (error) return { error: error.message };
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

export async function handleGetEmailThread(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  let messages: ChannelMessageRow[] = [];
  if (args.thread_id) {
    const { data } = await supabase
      .from("channel_messages")
      .select("id, direction, from_address, to_address, subject, body_text, email_date")
      .eq("user_id", userId)
      .eq("thread_id", args.thread_id as string)
      .order("email_date", { ascending: true });
    messages = (data || []) as ChannelMessageRow[];
  }
  if (messages.length === 0 && args.partner_id) {
    const { data } = await supabase
      .from("channel_messages")
      .select("id, direction, from_address, to_address, subject, body_text, email_date")
      .eq("user_id", userId)
      .eq("partner_id", args.partner_id as string)
      .eq("channel", "email")
      .order("email_date", { ascending: true })
      .limit(Number(args.limit) || 50);
    messages = (data || []) as ChannelMessageRow[];
  }
  if (messages.length === 0 && args.email_address) {
    const { data } = await supabase
      .from("channel_messages")
      .select("id, direction, from_address, to_address, subject, body_text, email_date")
      .eq("user_id", userId)
      .eq("channel", "email")
      .or(`from_address.ilike.%${args.email_address}%,to_address.ilike.%${args.email_address}%`)
      .order("email_date", { ascending: true })
      .limit(Number(args.limit) || 50);
    messages = (data || []) as ChannelMessageRow[];
  }
  return {
    count: messages.length,
    thread: messages.map((m) => ({
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

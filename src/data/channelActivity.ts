/**
 * DAL: attività canali (WhatsApp / LinkedIn) per pannello Automazioni.
 * Mostra gli ultimi messaggi inbound/outbound + dispatch in coda.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ChannelActivityRow {
  id: string;
  channel: "whatsapp" | "linkedin" | string;
  direction: "in" | "out" | string;
  who: string | null;
  preview: string | null;
  created_at: string;
  kind: "message" | "dispatch";
  status?: string | null;
}

export async function listRecentChannelActivity(limit = 30): Promise<ChannelActivityRow[]> {
  const [msgs, queue] = await Promise.all([
    supabase
      .from("channel_messages")
      .select("id,channel,direction,from_address,to_address,from_name,to_name,body_text,subject,created_at")
      .in("channel", ["whatsapp", "linkedin"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("extension_dispatch_queue")
      .select("id,channel,recipient,message_text,status,created_at")
      .in("channel", ["whatsapp", "linkedin"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const rows: ChannelActivityRow[] = [];
  for (const m of (msgs.data ?? []) as Array<Record<string, unknown>>) {
    const dir = String(m.direction ?? "");
    const who = dir === "in"
      ? (m.from_name as string | null) ?? (m.from_address as string | null)
      : (m.to_name as string | null) ?? (m.to_address as string | null);
    rows.push({
      id: String(m.id),
      channel: String(m.channel),
      direction: dir,
      who: who ?? null,
      preview: ((m.body_text as string | null) ?? (m.subject as string | null) ?? "").slice(0, 120) || null,
      created_at: String(m.created_at),
      kind: "message",
    });
  }
  for (const q of (queue.data ?? []) as Array<Record<string, unknown>>) {
    rows.push({
      id: String(q.id),
      channel: String(q.channel),
      direction: "out",
      who: (q.recipient as string | null) ?? null,
      preview: ((q.message_text as string | null) ?? "").slice(0, 120) || null,
      created_at: String(q.created_at),
      kind: "dispatch",
      status: (q.status as string | null) ?? null,
    });
  }
  rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return rows.slice(0, limit);
}

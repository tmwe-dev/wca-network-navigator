/**
 * inboxTools.ts — Inbox, conversations, email threads, holding patterns.
 */
import { supabase, type ChannelMessageRow, type HoldingItem } from "../platformToolHelpers.ts";
import { escapeLike } from "../sqlEscape.ts";

async function resolvePartnerId(args: Record<string, unknown>): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .eq("id", args.partner_id)
      .single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .ilike("company_name", `%${escapeLike(args.company_name as string)}%`)
      .limit(1)
      .single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  return null;
}

export async function executeInboxToolHandler(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  switch (name) {
    case "get_inbox": {
      let query = supabase
        .from("channel_messages")
        .select(
          "id, channel, direction, from_address, to_address, subject, body_text, email_date, read_at, partner_id, category, created_at",
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

    case "get_conversation_history": {
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
          }),
        );
        const { data: acts } = await supabase
          .from("activities")
          .select("id, title, activity_type, status, created_at, description")
          .or(`partner_id.eq.${pid},source_id.eq.${pid}`)
          .order("created_at", { ascending: false })
          .limit(30);
        (acts || []).forEach(
          (a: { activity_type: string; title: string; status: string; created_at: string }) =>
            timeline.push({
              type: "activity",
              subtype: a.activity_type,
              title: a.title,
              status: a.status,
              date: a.created_at,
            }),
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
            }),
        );
      }
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { count: timeline.length, timeline: timeline.slice(0, Number(args.limit) || 50) };
    }

    case "get_email_thread": {
      let messages: ChannelMessageRow[] = [];
      if (args.thread_id) {
        const { data } = await supabase
          .from("channel_messages")
          .select("id, direction, from_address, to_address, subject, body_text, email_date")
          .eq("user_id", userId)
          .eq("thread_id", args.thread_id)
          .order("email_date", { ascending: true });
        messages = (data || []) as ChannelMessageRow[];
      }
      if (messages.length === 0 && args.partner_id) {
        const { data } = await supabase
          .from("channel_messages")
          .select("id, direction, from_address, to_address, subject, body_text, email_date")
          .eq("user_id", userId)
          .eq("partner_id", args.partner_id)
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

    case "get_holding_pattern": {
      const items: HoldingItem[] = [];
      const activeStatuses = ["first_touch_sent", "holding", "engaged", "qualified", "negotiation"];
      const now = new Date();
      if (!args.source_type || args.source_type === "wca" || args.source_type === "all") {
        let pq = supabase
          .from("partners")
          .select("id, company_name, country_code, city, email, lead_status, last_interaction_at, interaction_count")
          .in("lead_status", activeStatuses)
          .order("last_interaction_at", { ascending: true, nullsFirst: true });
        if (args.country_code) pq = pq.eq("country_code", String(args.country_code).toUpperCase());
        const { data: partners } = await pq.limit(Number(args.limit) || 50);
        (partners || []).forEach(
          (p: {
            id: string;
            company_name: string;
            country_code: string;
            city: string;
            email: string | null;
            lead_status: string;
            last_interaction_at: string | null;
            interaction_count: number;
          }) => {
            const days = p.last_interaction_at
              ? Math.floor((now.getTime() - new Date(p.last_interaction_at).getTime()) / 86400000)
              : 999;
            if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
            if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
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
          },
        );
      }
      if (!args.source_type || args.source_type === "crm" || args.source_type === "all") {
        const cq = supabase
          .from("imported_contacts")
          .select("id, name, company_name, country, city, email, lead_status, last_interaction_at, interaction_count")
          .in("lead_status", activeStatuses)
          .order("last_interaction_at", { ascending: true, nullsFirst: true });
        const { data: contacts } = await cq.limit(Number(args.limit) || 50);
        (contacts || []).forEach(
          (c: {
            id: string;
            name: string;
            company_name: string;
            country: string;
            city: string;
            email: string | null;
            lead_status: string;
            last_interaction_at: string | null;
            interaction_count: number;
          }) => {
            const days = c.last_interaction_at
              ? Math.floor((now.getTime() - new Date(c.last_interaction_at).getTime()) / 86400000)
              : 999;
            if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
            if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
            items.push({
              id: c.id,
              source: "crm",
              name: c.company_name || c.name || "—",
              country: c.country,
              email: c.email,
              status: c.lead_status,
              days_waiting: days,
            });
          },
        );
      }
      items.sort((a, b) => b.days_waiting - a.days_waiting);
      return { count: items.length, items: items.slice(0, Number(args.limit) || 50) };
    }

    default:
      return { error: `Unknown inbox tool: ${name}` };
  }
}

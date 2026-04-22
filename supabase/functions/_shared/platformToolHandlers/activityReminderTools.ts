/**
 * activityReminderTools.ts — Activity and reminder handlers.
 */
import { supabase, resolvePartnerId, type ActivityRow } from "../platformToolHelpers.ts";

export async function executeActivityReminderToolHandler(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  switch (name) {
    case "list_activities": {
      let query = supabase
        .from("activities")
        .select("id, title, activity_type, status, priority, due_date, partner_id, source_meta, created_at")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(Number(args.limit) || 30);
      if (args.status) query = query.eq("status", args.status);
      if (args.activity_type) query = query.eq("activity_type", args.activity_type);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return {
        count: data?.length || 0,
        activities: (data || []).map(
          (a: { source_meta: Record<string, unknown> | null } & Record<string, unknown>) => ({
            ...a,
            company_name: (a.source_meta as Record<string, unknown> | null)?.company_name || null,
          }),
        ),
      };
    }

    case "create_activity": {
      let partnerId = args.partner_id as string | null;
      let companyName = (args.company_name as string) || "";
      if (!partnerId && companyName) {
        const r = await resolvePartnerId(args);
        if (r) {
          partnerId = r.id;
          companyName = r.name;
        }
      }
      const { data, error } = await supabase
        .from("activities")
        .insert({
          title: String(args.title),
          description: args.description ? String(args.description) : null,
          activity_type: String(args.activity_type),
          source_type: "partner",
          source_id: partnerId || crypto.randomUUID(),
          partner_id: partnerId,
          due_date: args.due_date ? String(args.due_date) : null,
          priority: String(args.priority || "medium"),
          source_meta: { company_name: companyName } as Record<string, unknown>,
          user_id: userId,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      return { success: true, activity_id: data.id, message: `Attività "${args.title}" creata.` };
    }

    case "update_activity": {
      const updates: Record<string, unknown> = {};
      if (args.status) {
        updates.status = args.status;
        if (args.status === "completed") updates.completed_at = new Date().toISOString();
      }
      if (args.priority) updates.priority = args.priority;
      if (args.due_date) updates.due_date = args.due_date;
      const { error } = await supabase.from("activities").update(updates).eq("id", args.activity_id);
      if (error) return { error: error.message };
      return { success: true, message: "Attività aggiornata." };
    }

    case "list_reminders": {
      let query = supabase
        .from("reminders")
        .select("id, title, description, due_date, priority, status, partner_id")
        .order("due_date", { ascending: true })
        .limit(30);
      if (args.status) query = query.eq("status", args.status);
      if (args.priority) query = query.eq("priority", args.priority);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, reminders: data || [] };
    }

    case "create_reminder": {
      const partner = await resolvePartnerId(args);
      if (!partner) return { error: "Partner non trovato" };
      const { error } = await supabase.from("reminders").insert({
        partner_id: partner.id,
        title: String(args.title),
        description: args.description ? String(args.description) : null,
        due_date: String(args.due_date),
        priority: String(args.priority || "medium"),
        user_id: userId,
      });
      if (error) return { error: error.message };
      return { success: true, message: `Reminder creato per "${partner.name}".` };
    }

    default:
      return { error: `Unknown activity/reminder tool: ${name}` };
  }
}

/**
 * tools/activities.ts — handler del dominio "activities & reminders" per
 * agent-execute.
 *
 * Estratto da `index.ts` in sessione #24 (Ondata 2, Fase 4 Vol. I — split
 * dei file monolitici). Contiene i case che operano su `activities`,
 * `reminders`, `imported_contacts.lead_status`.
 *
 * Tool gestiti:
 *  - list_activities
 *  - create_activity
 *  - update_activity
 *  - list_reminders
 *  - create_reminder
 *  - update_reminder
 *  - update_lead_status
 */
import { resolvePartnerId } from "./shared.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export const ACTIVITY_TOOLS = new Set<string>([
  "list_activities",
  "create_activity",
  "update_activity",
  "list_reminders",
  "create_reminder",
  "update_reminder",
  "update_lead_status",
]);

export async function executeActivityTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<unknown> {
  switch (name) {
    case "list_reminders": {
      let query = supabase.from("reminders").select("id, title, description, due_date, priority, status, partner_id").order("due_date", { ascending: true }).limit(30);
      if (args.status) query = query.eq("status", args.status);
      if (args.priority) query = query.eq("priority", args.priority);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, reminders: data || [] };
    }

    case "create_reminder": {
      const partner = await resolvePartnerId(supabase, args);
      if (!partner) return { error: "Partner non trovato" };
      const { error } = await supabase.from("reminders").insert({ partner_id: partner.id, title: String(args.title), description: args.description ? String(args.description) : null, due_date: String(args.due_date), priority: String(args.priority || "medium") });
      if (error) return { error: error.message };
      return { success: true, message: `Reminder creato per "${partner.name}".` };
    }

    case "update_reminder": {
      if (args.delete) {
        const { error } = await supabase.from("reminders").delete().eq("id", args.reminder_id);
        return error ? { error: error.message } : { success: true };
      }
      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.priority) updates.priority = args.priority;
      if (args.due_date) updates.due_date = args.due_date;
      const { error } = await supabase.from("reminders").update(updates).eq("id", args.reminder_id);
      return error ? { error: error.message } : { success: true };
    }

    case "update_lead_status": {
      const status = String(args.status);
      if (args.contact_ids && Array.isArray(args.contact_ids)) {
        const { error } = await supabase.from("imported_contacts").update({ lead_status: status }).in("id", args.contact_ids as string[]);
        if (error) return { error: error.message };
        return { success: true, updated: (args.contact_ids as string[]).length };
      }
      return { error: "Specificare contact_ids" };
    }

    case "list_activities": {
      let query = supabase.from("activities").select("id, title, activity_type, status, priority, due_date, partner_id, source_meta, created_at").order("due_date", { ascending: true, nullsFirst: false }).limit(Number(args.limit) || 30);
      if (args.status) query = query.eq("status", args.status);
      if (args.activity_type) query = query.eq("activity_type", args.activity_type);
      const { data, error } = await query;
      if (error) return { error: error.message };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { count: data?.length || 0, activities: (data || []).map((a: any) => ({ ...a, company_name: (a.source_meta as any)?.company_name || null })) };
    }

    case "create_activity": {
      let partnerId = (args.partner_id as string | null) ?? null;
      let companyName = (args.company_name as string) || "";
      if (!partnerId && companyName) { const r = await resolvePartnerId(supabase, args); if (r) { partnerId = r.id; companyName = r.name; } }
      const { data, error } = await supabase.from("activities").insert({
        title: String(args.title), description: args.description ? String(args.description) : null,
        activity_type: String(args.activity_type), source_type: "partner", source_id: partnerId || crypto.randomUUID(),
        partner_id: partnerId, due_date: args.due_date ? String(args.due_date) : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priority: String(args.priority || "medium"), source_meta: { company_name: companyName } as any,
      }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, activity_id: data.id, message: `Attività "${args.title}" creata.` };
    }

    case "update_activity": {
      const updates: Record<string, unknown> = {};
      if (args.status) { updates.status = args.status; if (args.status === "completed") updates.completed_at = new Date().toISOString(); }
      if (args.priority) updates.priority = args.priority;
      if (args.due_date) updates.due_date = args.due_date;
      const { error } = await supabase.from("activities").update(updates).eq("id", args.activity_id);
      if (error) return { error: error.message };
      return { success: true, message: "Attività aggiornata." };
    }

    default:
      throw new Error(`executeActivityTool: tool non gestito "${name}"`);
  }
}

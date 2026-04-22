/**
 * contactManagementTools.ts — Partner contact management and UI actions.
 */
import { supabase, resolvePartnerId } from "../platformToolHelpers.ts";

export async function executeContactManagementToolHandler(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  switch (name) {
    case "manage_partner_contact": {
      const action = String(args.action);
      if (action === "delete" && args.contact_id) {
        const { error } = await supabase.from("partner_contacts").delete().eq("id", args.contact_id);
        return error ? { error: error.message } : { success: true, message: "Contatto eliminato." };
      }
      if (action === "update" && args.contact_id) {
        const updates: Record<string, unknown> = {};
        if (args.name) updates.name = args.name;
        if (args.title) updates.title = args.title;
        if (args.email) updates.email = args.email;
        if (args.direct_phone) updates.direct_phone = args.direct_phone;
        if (args.mobile) updates.mobile = args.mobile;
        const { error } = await supabase.from("partner_contacts").update(updates).eq("id", args.contact_id);
        return error ? { error: error.message } : { success: true, message: "Contatto aggiornato." };
      }
      if (action === "add") {
        let pid = args.partner_id as string;
        if (!pid && args.company_name) {
          const r = await resolvePartnerId(args);
          if (r) pid = r.id;
        }
        if (!pid) return { error: "Partner non trovato" };
        const { error } = await supabase.from("partner_contacts").insert({
          partner_id: pid,
          name: String(args.name),
          title: args.title ? String(args.title) : null,
          email: args.email ? String(args.email) : null,
        });
        return error
          ? { error: error.message }
          : { success: true, message: `Contatto "${args.name}" aggiunto.` };
      }
      return { error: "Azione non valida" };
    }

    case "execute_ui_action": {
      const action = String(args.action || "toast");
      const target = String(args.target || "");
      return { success: true, ui_action: { action, target, params: args.params || {} } };
    }

    default:
      return { error: `Unknown contact management tool: ${name}` };
  }
}

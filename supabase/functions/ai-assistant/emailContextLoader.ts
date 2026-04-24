/**
 * emailContextLoader.ts — Recent email context for AI assistant.
 *
 * Loads:
 * - Recent emails by mentioned addresses
 * - Recent emails by mentioned contact names
 * - Unread email fallback
 * - Email classification data
 */

import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export async function loadRecentEmailContext(
  supabase: SupabaseClient,
  userId: string,
  messageText: string,
): Promise<string> {
  try {
    const mentionedEmails = messageText.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
    const mentionedNames = messageText.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];

    const contextParts: string[] = [];

    // If user mentions specific email addresses, load conversation with that sender
    if (mentionedEmails.length > 0) {
      for (const email of mentionedEmails.slice(0, 3)) {
        const { data: recentMsgs } = await supabase
          .from("channel_messages")
          .select("direction, from_address, to_address, subject, body_text, created_at, category")
          .eq("user_id", userId)
          .or(`from_address.eq.${email},to_address.eq.${email}`)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentMsgs?.length) {
          contextParts.push(`\n--- EMAIL RECENTI con ${email} ---`);
          for (const msg of recentMsgs as Record<string, unknown>[]) {
            const dir = msg.direction === "inbound" ? "RICEVUTA" : "INVIATA";
            const date = new Date(msg.created_at as string).toLocaleDateString("it-IT");
            contextParts.push(
              `[${dir} ${date}] Subject: ${msg.subject || "(nessuno)"}\n` +
              `${(String(msg.body_text || "")).slice(0, 300)}...`
            );
          }
        }

        const { data: classification } = await supabase
          .from("email_classifications")
          .select("category, confidence, sentiment, urgency, ai_summary, action_suggested")
          .eq("user_id", userId)
          .eq("email_address", email)
          .order("classified_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (classification) {
          const c = classification as Record<string, unknown>;
          contextParts.push(
            `\n--- CLASSIFICAZIONE AI per ${email} ---\n` +
            `Categoria: ${c.category} (${Math.round(((c.confidence as number) || 0) * 100)}%)\n` +
            `Sentiment: ${c.sentiment} | Urgenza: ${c.urgency}\n` +
            `Riepilogo: ${c.ai_summary || "n/d"}\n` +
            `Azione suggerita: ${c.action_suggested || "nessuna"}`
          );
        }
      }
    }

    // If user mentions a name, find the contact and their emails
    if (mentionedNames.length > 0 && contextParts.length === 0) {
      for (const name of mentionedNames.slice(0, 2)) {
        const { data: contacts } = await supabase
          .from("imported_contacts")
          .select("id, email, name, lead_status")
          .eq("user_id", userId)
          .ilike("name", `%${name}%`)
          .limit(3);

        const { data: partners } = await supabase
          .from("partners")
          .select("id, email, company_name, lead_status")
          .eq("user_id", userId)
          .ilike("company_name", `%${name}%`)
          .limit(3);

        const allMatches = [
          ...(contacts?.map((c: Record<string, unknown>) => ({ email: c.email as string | null, name: c.name as string, status: c.lead_status as string })) || []),
          ...(partners?.map((p: Record<string, unknown>) => ({ email: p.email as string | null, name: p.company_name as string, status: p.lead_status as string })) || []),
        ];

        for (const match of allMatches.slice(0, 2)) {
          if (!match.email) continue;
          const { data: msgs } = await supabase
            .from("channel_messages")
            .select("direction, subject, body_text, created_at")
            .eq("user_id", userId)
            .or(`from_address.eq.${match.email},to_address.eq.${match.email}`)
            .order("created_at", { ascending: false })
            .limit(3);

          if (msgs?.length) {
            contextParts.push(`\n--- EMAIL RECENTI con ${match.name} (${match.email}) — Status: ${match.status} ---`);
            for (const msg of msgs as Record<string, unknown>[]) {
              const dir = msg.direction === "inbound" ? "RICEVUTA" : "INVIATA";
              contextParts.push(
                `[${dir}] ${msg.subject || "(nessuno)"}: ${(String(msg.body_text || "")).slice(0, 200)}...`
              );
            }
          }
        }
      }
    }

    // Fallback: last 5 unread inbound emails
    if (contextParts.length === 0) {
      const { data: unread } = await supabase
        .from("channel_messages")
        .select("from_address, subject, created_at, category")
        .eq("user_id", userId)
        .eq("direction", "inbound")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (unread?.length) {
        contextParts.push(`\n--- ULTIME ${unread.length} EMAIL NON LETTE ---`);
        for (const msg of unread as Record<string, unknown>[]) {
          contextParts.push(`Da: ${msg.from_address} | Subject: ${msg.subject} | ${new Date(msg.created_at as string).toLocaleDateString("it-IT")}`);
        }
      }
    }

    return contextParts.join("\n");
  } catch (e: unknown) {
    console.warn("loadRecentEmailContext failed:", extractErrorMessage(e));
    return "";
  }
}

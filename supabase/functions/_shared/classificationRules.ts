/**
 * classificationRules.ts — Handling for email address rules and draft generation.
 * Extracted from postClassificationPipeline.ts (LOVABLE-93 features)
 */

import { aiChat } from "./aiGateway.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface EmailAddressRule {
  category?: string;
  custom_prompt?: string;
  tone_override?: string;
  topics_to_emphasize?: string[];
  topics_to_avoid?: string[];
}

export interface ClassificationInput {
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
  category: string;
  confidence: number;
  senderEmail: string;
  senderName?: string;
  subject?: string;
  aiSummary?: string;
  urgency?: number;
  sentiment?: string;
  channel?: "email" | "whatsapp" | "linkedin";
  oooReturnDate?: string;
  emailAddressRule?: EmailAddressRule;
  domain?: string;
}

/**
 * Carica email_address_rules per un sender.
 */
export async function loadEmailAddressRules(
  supabase: SupabaseClient,
  userId: string,
  senderEmail: string,
): Promise<EmailAddressRule | null> {
  const { data: addressRule } = await supabase
    .from("email_address_rules")
    .select("category, custom_prompt, tone_override, topics_to_emphasize, topics_to_avoid")
    .eq("email_address", senderEmail)
    .eq("user_id", userId)
    .maybeSingle();

  return addressRule || null;
}

/**
 * Genera un draft di risposta utilizzando aiChat.
 * Fire-and-forget: eventuali errori non bloccano il flusso principale.
 */
export async function generateReplyDraft(
  supabase: SupabaseClient,
  pendingActionId: string,
  input: ClassificationInput,
  category: "reply_interested" | "reply_to_question" | "handle_complaint" | "send_graceful_close",
): Promise<void> {
  try {
    let tone = "professional";
    let categoryHint = "";

    switch (category) {
      case "reply_interested":
        tone = "warm";
        categoryHint = "Il partner ha mostrato interesse. La risposta deve essere positiva, concreta e proporre i prossimi step.";
        break;
      case "reply_to_question":
        tone = "helpful";
        categoryHint = "Il partner ha posto una domanda. La risposta deve essere chiara, utile e basata su KB/expertise disponibile.";
        break;
      case "handle_complaint":
        tone = "empathetic";
        categoryHint = "È stato ricevuto un reclamo. La risposta deve essere empatica, riconoscere il problema e proporre una soluzione concreta.";
        break;
      case "send_graceful_close":
        tone = "graceful";
        categoryHint = "Il partner non è interessato. La risposta deve chiudere con eleganza, ringraziare e lasciare la porta aperta senza pressione.";
        break;
    }

    const topicsStr = (input.emailAddressRule?.topics_to_emphasize || []).join(", ");

    const systemPrompt = `Tu sei un assistente AI per la composizione di email professionali.
Tono richiesto: ${tone}
Contesto: ${categoryHint}
${input.emailAddressRule?.custom_prompt ? `Istruzioni personalizzate: ${input.emailAddressRule.custom_prompt}` : ""}
${topicsStr ? `Topic da enfatizzare: ${topicsStr}` : ""}`;

    const userPrompt = `Genera un draft di risposta email basato su:
- Riassunto dell'email originale: ${input.aiSummary || "N/A"}
- Oggetto originale: ${input.subject || "N/A"}
- Email mittente: ${input.senderEmail}

Restituisci il draft in questo formato JSON:
{
  "draft_subject": "Oggetto della risposta",
  "draft_body": "Corpo della risposta (markdown semplice, max 300 parole)"
}`;

    const result = await aiChat({
      models: ["google/gemini-2.5-flash"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      context: `draft_generation_${category}`,
    });

    if (result.content) {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const draft = JSON.parse(jsonMatch[0]);
        if (draft.draft_subject && draft.draft_body) {
          await supabase
            .from("ai_pending_actions")
            .update({
              // deno-lint-ignore no-explicit-any
              action_payload: ((action_payload: any) => ({
                ...action_payload,
                draft_subject: draft.draft_subject,
                draft_body: draft.draft_body,
                draft_generated_at: new Date().toISOString(),
              })) as unknown as Record<string, unknown>,
            })
            .eq("id", pendingActionId);
        }
      }
    }
  } catch (e) {
    console.warn(`[LOVABLE-93] Draft generation failed for ${category}: ${e}`);
  }
}

/**
 * Arricchisce il payload di una pending action con email_address_rules context.
 */
export function enrichActionPayload(
  basePayload: Record<string, unknown>,
  emailAddressRule: EmailAddressRule | undefined,
): Record<string, unknown> {
  const payload = { ...basePayload };

  if (emailAddressRule) {
    if (emailAddressRule.tone_override) {
      payload.tone_override = emailAddressRule.tone_override;
    }
    if (emailAddressRule.custom_prompt) {
      payload.custom_prompt = emailAddressRule.custom_prompt;
    }
    if (emailAddressRule.topics_to_emphasize?.length) {
      payload.topics_to_emphasize = emailAddressRule.topics_to_emphasize;
    }
    if (emailAddressRule.topics_to_avoid?.length) {
      payload.topics_to_avoid = emailAddressRule.topics_to_avoid;
    }
  }

  return payload;
}

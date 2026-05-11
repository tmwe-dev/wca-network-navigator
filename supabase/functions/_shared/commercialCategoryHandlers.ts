/**
 * commercialCategoryHandlers.ts — Handler tematici per le 16 categorie commerciali
 * (Blocco 3 del piano email pipeline). Ciascun handler crea una ai_pending_action
 * con action_type, requires_approval e priority coerenti con la doctrine.
 * Nessun handler invia messaggi diretti: ogni outbound passa da pending-action-executor
 * → orchestratori → journalistReview.
 */

import { enrichActionPayload, type EmailAddressRule } from "./classificationRules.ts";
import { handleQuestion, type QuestionComplaintInput } from "./questionAndComplaintHandler.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface CommercialHandlerInput {
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
  emailAddressRule?: EmailAddressRule;
}

export interface PostResult {
  actionsExecuted: string[];
  statusChanged: boolean;
  pendingActionCreated: boolean;
  reminderCreated: boolean;
  errors: string[];
}

function priorityFor(urgency?: number): "low" | "normal" | "high" | "critical" {
  const u = urgency ?? 2;
  if (u >= 5) return "critical";
  if (u >= 4) return "high";
  if (u >= 2) return "normal";
  return "low";
}

async function insertPending(
  supabase: SupabaseClient,
  input: CommercialHandlerInput,
  actionType: string,
  payload: Record<string, unknown>,
  priority: string,
  result: PostResult,
  tag: string,
) {
  try {
    const enriched = enrichActionPayload(payload, input.emailAddressRule);
    const { data: row } = await supabase
      .from("ai_pending_actions")
      .insert({
        user_id: input.userId,
        partner_id: input.partnerId || null,
        action_type: actionType,
        action_payload: enriched,
        status: "pending",
        priority,
      })
      .select("id")
      .single();
    if (row?.id) {
      result.pendingActionCreated = true;
      result.actionsExecuted.push(tag);
    }
  } catch (e) {
    result.errors.push(`${actionType} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** quote_request, booking_request, rate_inquiry → prepare_quote */
export async function handleQuoteOrBooking(
  supabase: SupabaseClient,
  input: CommercialHandlerInput,
  result: PostResult,
) {
  await insertPending(
    supabase,
    input,
    "prepare_quote",
    {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      urgency: input.urgency,
      sub_category: input.category,
      suggested_action:
        input.category === "booking_request"
          ? "Conferma booking richiesto: verificare spazio/tariffa e preparare conferma"
          : "Preparare quotazione: estrarre rotta, equipment, peso/volume da inbound",
    },
    priorityFor(input.urgency),
    result,
    `pending_${input.category}`,
  );
}

/** shipment_tracking, cargo_status, documentation_request → lookup_shipment */
export async function handleShipmentOps(
  supabase: SupabaseClient,
  input: CommercialHandlerInput,
  result: PostResult,
) {
  await insertPending(
    supabase,
    input,
    "lookup_shipment",
    {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      urgency: input.urgency,
      sub_category: input.category,
      suggested_action:
        input.category === "documentation_request"
          ? "Richiesta documentazione: recuperare AWB/B-L/POD e rispondere"
          : "Tracking richiesto: lookup TMWE live + risposta con stato attuale",
    },
    priorityFor(input.urgency ?? 3),
    result,
    `pending_${input.category}`,
  );
}

/** invoice_query, payment_request, payment_confirmation, credit_note, account_statement → financial_review */
export async function handleFinancialQuery(
  supabase: SupabaseClient,
  input: CommercialHandlerInput,
  result: PostResult,
) {
  await insertPending(
    supabase,
    input,
    "financial_review",
    {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      urgency: input.urgency,
      sub_category: input.category,
      escalate_to: "admin",
      suggested_action:
        input.category === "payment_confirmation"
          ? "Conferma pagamento ricevuta: registrare e ringraziare"
          : "Query amministrativa: escalation team admin per verifica e risposta",
    },
    priorityFor(input.urgency ?? 3),
    result,
    `pending_${input.category}`,
  );
}

/** service_inquiry, technical_issue, feedback → delega a handleQuestion con tag service */
export async function handleServiceOrSupport(
  supabase: SupabaseClient,
  input: CommercialHandlerInput,
  result: PostResult,
) {
  const qInput: QuestionComplaintInput = {
    userId: input.userId,
    partnerId: input.partnerId,
    contactId: input.contactId,
    category: input.category,
    confidence: input.confidence,
    senderEmail: input.senderEmail,
    senderName: input.senderName,
    subject: input.subject,
    aiSummary: input.aiSummary,
    urgency: input.urgency,
    sentiment: input.sentiment,
    emailAddressRule: input.emailAddressRule,
  };
  await handleQuestion(supabase, qInput, result);
  result.actionsExecuted.push(`tagged_service_${input.category}`);
}

/** newsletter, system_notification → no action, marker per learning loop */
export async function handleNoise(
  _supabase: SupabaseClient,
  input: CommercialHandlerInput,
  result: PostResult,
) {
  result.actionsExecuted.push(`skip_noise_${input.category}`);
}
/**
 * DAL V3 — Scrivi (Modulo 5, Risposta).
 *
 * Due operazioni:
 * - ricerca destinatari su contatti importati e partner (sola lettura);
 * - messa in coda della bozza come azione pendente: l'invio reale passa
 *   SEMPRE dalle Approvazioni (editorial review + conferma umana).
 */
import { supabase } from "@/integrations/supabase/client";
import { insertPendingActionReturningId } from "@/data/aiPendingActions";
import { invokeAi } from "@/lib/ai/invokeAi";

export interface V3Destinatario {
  readonly id: string;
  readonly tipo: "contatto" | "partner";
  readonly nome: string | null;
  readonly azienda: string | null;
  readonly email: string;
  readonly partnerId: string | null;
  readonly contattoId: string | null;
}

function sanitizeSearch(value: string): string {
  return value.replace(/[,()\\%*]/g, " ").trim();
}

/** Cerca contatti e partner con email valorizzata. Max 20 risultati complessivi. */
export async function cercaDestinatariV3(ricerca: string): Promise<readonly V3Destinatario[]> {
  const term = sanitizeSearch(ricerca);
  if (term.length < 2) return [];

  const filtro = `name.ilike.%${term}%,email.ilike.%${term}%,company_name.ilike.%${term}%`;

  const [contatti, partner] = await Promise.all([
    supabase
      .from("imported_contacts")
      .select("id, name, email, company_name")
      .not("email", "is", null)
      .is("deleted_at", null)
      .or(filtro)
      .limit(12),
    supabase
      .from("partners")
      .select("id, company_name, email")
      .not("email", "is", null)
      .is("deleted_at", null)
      .or(`company_name.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(8),
  ]);

  if (contatti.error) throw contatti.error;
  if (partner.error) throw partner.error;

  const daContatti: V3Destinatario[] = (contatti.data ?? [])
    .filter((row) => typeof row.email === "string" && row.email.includes("@"))
    .map((row) => ({
      id: String(row.id),
      tipo: "contatto" as const,
      nome: (row.name as string | null) ?? null,
      azienda: (row.company_name as string | null) ?? null,
      email: String(row.email),
      partnerId: null,
      contattoId: String(row.id),
    }));

  const daPartner: V3Destinatario[] = (partner.data ?? [])
    .filter((row) => typeof row.email === "string" && row.email.includes("@"))
    .map((row) => ({
      id: String(row.id),
      tipo: "partner" as const,
      nome: null,
      azienda: (row.company_name as string | null) ?? null,
      email: String(row.email),
      partnerId: String(row.id),
      contattoId: null,
    }));

  return [...daContatti, ...daPartner].slice(0, 20);
}

export interface V3BozzaInput {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly partnerId?: string | null;
  readonly contattoId?: string | null;
}

/**
 * Mette la bozza in coda di approvazione. Nessun invio diretto:
 * la riga creata appare in /v3/approvazioni e parte solo dopo conferma umana.
 */
export async function accodaBozzaV3(input: V3BozzaInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessione scaduta: effettua di nuovo l'accesso.");

  const { id, error } = await insertPendingActionReturningId({
    user_id: user.id,
    action_type: "send_email",
    action_payload: {
      to: input.to,
      subject: input.subject,
      body: input.body,
      html: input.body.replace(/\n/g, "<br/>"),
      partner_id: input.partnerId ?? null,
      contact_id: input.contattoId ?? null,
    },
    partner_id: input.partnerId ?? null,
    contact_id: input.contattoId ?? null,
    email_address: input.to,
    suggested_content: input.body,
    reasoning: "Bozza composta da Scrivi (V3): in attesa di approvazione umana.",
    confidence: 1.0,
    source: "v3-scrivi",
    status: "pending",
  });

  if (error) throw new Error(error.message);
  return id ?? "";
}

/* ─────────── Generazione assistita (agente di scrittura) ─────────── */

export interface V3GeneraInput {
  readonly obiettivo: string;
  readonly nome?: string | null;
  readonly azienda?: string | null;
  readonly partnerId?: string | null;
  readonly contattoId?: string | null;
}

export interface V3Bozza {
  readonly oggetto: string;
  readonly corpo: string;
  /** Esito della revisione editoriale, quando l'agente la restituisce. */
  readonly revisione: {
    readonly verdetto: string;
    readonly punteggio: number | null;
    readonly note: readonly string[];
  } | null;
}

interface GenerateEmailResponse {
  subject?: string;
  body?: string;
  full_content?: string;
  journalist_review?: {
    verdict?: string;
    quality_score?: number;
    warnings?: { description?: string }[];
  } | null;
}

/**
 * Chiede all'agente di scrittura una bozza. Non salva e non invia nulla:
 * il testo torna nell'editor, l'operatore lo corregge e poi lo accoda.
 * Riusa l'edge `generate-email` esistente (editorial review inclusa).
 */
export async function generaBozzaV3(input: V3GeneraInput): Promise<V3Bozza> {
  const data = await invokeAi<GenerateEmailResponse>("generate-email", {
    scope: "email",
    context: { source: "v3/scrivi", mode: "generate", route: "/v3/scrivi" },
    body: {
      standalone: true,
      partner_id: input.partnerId ?? null,
      contact_id: input.contattoId ?? null,
      recipient_name: input.nome ?? undefined,
      recipient_company: input.azienda ?? undefined,
      goal: input.obiettivo,
      use_kb: true,
      quality: "standard",
    },
  });

  const review = data.journalist_review ?? null;
  return {
    oggetto: data.subject ?? "",
    corpo: data.body ?? data.full_content ?? "",
    revisione: review
      ? {
          verdetto: String(review.verdict ?? "pass"),
          punteggio: typeof review.quality_score === "number" ? review.quality_score : null,
          note: (review.warnings ?? [])
            .map((w) => w.description)
            .filter((d): d is string => typeof d === "string"),
        }
      : null,
  };
}

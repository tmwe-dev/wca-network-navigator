/**
 * funnemail-scout-sender — Scout livello 1 sul mittente di una email inbound.
 *
 * Logica:
 *  1. Estrae il dominio dall'indirizzo email.
 *  2. Cerca nel CRM (partners + contacts.email) un partner conosciuto.
 *     - Se trovato → ritorna `{ known: true, partner_id, partner_type }` SENZA
 *       chiamare AI (zero costi). Cache 30gg.
 *  3. Se mittente sconosciuto → controlla cache `funnemail_sender_intel`.
 *     - Cache fresca (expires_at > now) → ritorna l'esito cached.
 *  4. Cache mancante/scaduta → invoca `sherlock-extract` su un piccolo
 *     summary euristico del dominio (no scrape costoso, gratis lato gateway
 *     perché usa modello flash). L'output classifica company_type/role_guess.
 *  5. Salva l'esito in `funnemail_sender_intel`.
 *
 * Output minimale (chiamato server-to-server da classify-inbound-message):
 *   { known: boolean, partner_id?: string|null, intel: {
 *       company_type, country, website, role_guess, evidence
 *     } | null }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";

interface RequestBody {
  from_address: string;
  message_id?: string;
  user_id?: string | null;
  force?: boolean;
}

interface IntelResult {
  is_known_partner: boolean;
  partner_id: string | null;
  company_type: string | null;
  country: string | null;
  website: string | null;
  role_guess: string | null;
  evidence: Record<string, unknown>;
  scout_source: string;
}

const FREE_PROVIDERS = new Set([
  "gmail.com","googlemail.com","yahoo.com","yahoo.it","outlook.com",
  "hotmail.com","hotmail.it","live.com","libero.it","tiscali.it","alice.it",
  "icloud.com","me.com","aol.com","gmx.com","protonmail.com","pec.it",
]);

function extractDomain(email: string): string | null {
  const m = String(email).toLowerCase().trim().match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
  return m ? m[1] : null;
}

function jsonResp(body: unknown, status = 200, headers: Record<string,string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function findKnownPartner(
  supabase: ReturnType<typeof createClient>,
  fromAddress: string,
  domain: string,
): Promise<{ partner_id: string; company_type: string | null; country: string | null } | null> {
  // 1) Match esatto su contacts.email
  // deno-lint-ignore no-explicit-any
  const sb = supabase as any;
  const { data: byEmail } = await sb
    .from("contacts")
    .select("partner_id,partners(id,partner_type,country)")
    .ilike("email", fromAddress)
    .limit(1);
  const hit1 = byEmail?.[0]?.partners ?? null;
  if (hit1?.id) {
    return { partner_id: hit1.id as string, company_type: (hit1.partner_type as string) ?? null, country: (hit1.country as string) ?? null };
  }

  // 2) Match per dominio (skip provider gratuiti)
  if (!FREE_PROVIDERS.has(domain)) {
    const { data: byDomain } = await sb
      .from("partners")
      .select("id,partner_type,country,website")
      .or(`website.ilike.%${domain}%,email.ilike.%@${domain}`)
      .limit(1);
    const hit2 = byDomain?.[0] ?? null;
    if (hit2?.id) {
      return { partner_id: hit2.id as string, company_type: (hit2.partner_type as string) ?? null, country: (hit2.country as string) ?? null };
    }
  }

  return null;
}

async function scoutDomainViaAi(
  domain: string,
  fromAddress: string,
): Promise<Partial<IntelResult>> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return {};

  const prompt = `Stima rapidamente che tipo di azienda si nasconde dietro al dominio email.\n\nDOMINIO: ${domain}\nESEMPIO MITTENTE: ${fromAddress}\n\nRispondi SOLO con JSON nel formato:\n{"company_type":"freight_forwarder|client|supplier|carrier|service_provider|software|public_authority|unknown","country":"ISO2 o null","website":"https://... o null","role_guess":"potential_partner|potential_client|vendor|notification|unknown","reasoning":"max 200 char"}\n\nRegole:\n- Se il dominio sembra di un forwarder/agente logistico → company_type=freight_forwarder, role_guess=potential_partner\n- Se sembra software/SaaS → role_guess=vendor\n- Se domini noreply/notification → role_guess=notification\n- Se incerto → company_type=unknown, role_guess=unknown\n- NON inventare. Se non sai, "unknown".`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Sei uno scout: rispondi solo con il JSON richiesto, niente testo." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      company_type: (parsed.company_type as string) ?? "unknown",
      country: (parsed.country as string) ?? null,
      website: (parsed.website as string) ?? `https://${domain}`,
      role_guess: (parsed.role_guess as string) ?? "unknown",
      evidence: { reasoning: parsed.reasoning ?? "", domain, source: "scout_ai_v1" },
      scout_source: "scout_ai_v1",
    };
  } catch (_e) {
    return {};
  }
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("origin"));

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.from_address) {
      return jsonResp({ error: "from_address required" }, 400, cors);
    }

    // Auth: JWT utente o token interno server-to-server
    const auth = await requireInternalOrUser(req, body.user_id ?? null, cors);
    if (auth.kind === "error") return auth.response;
    if (auth.kind === "user") {
      if (body.user_id && body.user_id !== auth.userId) {
        return jsonResp({ error: "Forbidden: user_id mismatch" }, 403, cors);
      }
      body.user_id = auth.userId;
    }

    const domain = extractDomain(body.from_address);
    if (!domain) {
      return jsonResp({ known: false, partner_id: null, intel: null, reason: "invalid_email" }, 200, cors);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    // deno-lint-ignore no-explicit-any
    const sb = supabase as any;

    // 1) Cache check (skip se force)
    if (!body.force) {
      // 1a) Cache utente-specifica (Sprint 4)
      if (body.user_id) {
        const { data: userCached } = await sb
          .from("funnemail_scout_cache")
          .select("*")
          .eq("user_id", body.user_id)
          .or(`email_address.ilike.${body.from_address},and(email_address.is.null,email_domain.eq.${domain})`)
          .gt("expires_at", new Date().toISOString())
          .order("cached_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (userCached) {
          return jsonResp({
            known: !!userCached.is_known_partner,
            partner_id: userCached.partner_id,
            intel: {
              company_type: userCached.company_type,
              country: userCached.country,
              website: userCached.website,
              role_guess: userCached.role_guess,
              evidence: userCached.evidence ?? {},
            },
            cached: true,
            cache_scope: "user",
          }, 200, cors);
        }
      }
      // 1b) Cache globale legacy (fallback)
      const { data: cached } = await sb
        .from("funnemail_sender_intel")
        .select("*")
        .eq("email_domain", domain)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached) {
        return jsonResp({
          known: !!cached.is_known_partner,
          partner_id: cached.partner_id,
          intel: {
            company_type: cached.company_type,
            country: cached.country,
            website: cached.website,
            role_guess: cached.role_guess,
            evidence: cached.evidence ?? {},
          },
          cached: true,
          cache_scope: "global",
        }, 200, cors);
      }
    }

    // 2) Match partner conosciuto
    const known = await findKnownPartner(supabase, body.from_address, domain);
    let intel: IntelResult;
    if (known) {
      intel = {
        is_known_partner: true,
        partner_id: known.partner_id,
        company_type: known.company_type ?? "known_partner",
        country: known.country,
        website: null,
        role_guess: "known_partner",
        evidence: { match: "crm", domain },
        scout_source: "crm_lookup",
      };
    } else {
      // 3) Scout AI (modello lite, gratuito)
      const ai = await scoutDomainViaAi(domain, body.from_address);
      intel = {
        is_known_partner: false,
        partner_id: null,
        company_type: ai.company_type ?? "unknown",
        country: ai.country ?? null,
        website: ai.website ?? `https://${domain}`,
        role_guess: ai.role_guess ?? "unknown",
        evidence: ai.evidence ?? { domain, source: "scout_fallback" },
        scout_source: ai.scout_source ?? "scout_fallback",
      };
    }

    // 4) Upsert in cache (30gg)
    await sb
      .from("funnemail_sender_intel")
      .upsert({
        email_domain: domain,
        is_known_partner: intel.is_known_partner,
        partner_id: intel.partner_id,
        company_type: intel.company_type,
        country: intel.country,
        website: intel.website,
        role_guess: intel.role_guess,
        evidence: intel.evidence,
        scout_source: intel.scout_source,
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      }, { onConflict: "email_domain" });

    // 4b) Cache per-utente (Sprint 4) — non bloccante
    if (body.user_id) {
      try {
        const cachePayload = {
          user_id: body.user_id,
          email_domain: domain,
          email_address: null,
          is_known_partner: intel.is_known_partner,
          partner_id: intel.partner_id,
          company_type: intel.company_type,
          country: intel.country,
          website: intel.website,
          role_guess: intel.role_guess,
          evidence: intel.evidence,
          scout_source: intel.scout_source,
          expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
          cached_at: new Date().toISOString(),
        };
        const { data: existing } = await sb
          .from("funnemail_scout_cache")
          .select("id")
          .eq("user_id", body.user_id)
          .eq("email_domain", domain)
          .is("email_address", null)
          .maybeSingle();
        if (existing?.id) {
          await sb.from("funnemail_scout_cache").update(cachePayload).eq("id", existing.id);
        } else {
          await sb.from("funnemail_scout_cache").insert(cachePayload);
        }
      } catch (_) { /* fail-safe */ }
    }

    return jsonResp({
      known: intel.is_known_partner,
      partner_id: intel.partner_id,
      intel: {
        company_type: intel.company_type,
        country: intel.country,
        website: intel.website,
        role_guess: intel.role_guess,
        evidence: intel.evidence,
      },
      cached: false,
    }, 200, cors);
  } catch (error: unknown) {
    return jsonResp({ error: error instanceof Error ? error.message : String(error) }, 500, cors);
  }
});
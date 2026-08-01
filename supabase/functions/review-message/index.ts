/**
 * review-message — Editorial gate per WhatsApp e LinkedIn dal cockpit.
 *
 * I send manuali WA/LI sono client-side (postMessage → estensione), quindi
 * non passano dalle edge `send-whatsapp`/`send-linkedin`. Questa funzione
 * espone `journalistReview` ai cockpit hooks (`useSendWhatsApp` /
 * `useSendLinkedIn`) per garantire il gate hard previsto dalla doctrine
 * editoriale (memoria `editorial-review-layer-mandatory`).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { journalistReview } from "../_shared/journalistReviewLayer.ts";
import { loadOptimusSettings } from "../_shared/journalistSelector.ts";
import type { JournalistReviewInput, ReviewChannel } from "../_shared/journalistTypes.ts";

const ALLOWED_CHANNELS: ReviewChannel[] = ["whatsapp", "linkedin"];

Deno.serve(async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const channel = String(body.channel || "") as ReviewChannel;
    const draft = String(body.draft || "");
    const partnerId = body.partner_id ? String(body.partner_id) : null;
    const contactId = body.contact_id ? String(body.contact_id) : null;

    if (!ALLOWED_CHANNELS.includes(channel)) {
      return new Response(JSON.stringify({ error: "invalid_channel", allowed: ALLOWED_CHANNELS }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!draft.trim()) {
      return new Response(JSON.stringify({ error: "empty_draft" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Context per la review
    let leadStatus = "new";
    let companyName: string | null = null;
    let country: string | null = null;
    if (partnerId) {
      const { data: p } = await supabase
        .from("partners")
        .select("lead_status, company_name, country")
        .eq("id", partnerId).maybeSingle();
      if (p) {
        leadStatus = (p as { lead_status?: string }).lead_status || "new";
        companyName = (p as { company_name?: string }).company_name ?? null;
        country = (p as { country?: string }).country ?? null;
      }
    }
    let contactName: string | null = null;
    let contactRole: string | null = null;
    if (contactId) {
      const { data: c } = await supabase
        .from("imported_contacts")
        .select("name, role").eq("id", contactId).maybeSingle();
      if (c) {
        contactName = (c as { name?: string }).name ?? null;
        contactRole = (c as { role?: string }).role ?? null;
      }
    }

    const optimus = await loadOptimusSettings(supabase, userId);
    const reviewInput: JournalistReviewInput = {
      final_draft: draft,
      resolved_brief: {},
      channel,
      commercial_state: { lead_status: leadStatus },
      partner: { id: partnerId, company_name: companyName ?? undefined, country: country ?? undefined },
      contact: contactName ? { name: contactName, role: contactRole ?? undefined } : undefined,
    };
    const result = await journalistReview(supabase, userId, reviewInput, {
      mode: optimus.mode,
      strictness: optimus.strictness,
    });

    return new Response(JSON.stringify({
      verdict: result.verdict,
      edited_text: result.edited_text,
      warnings: result.warnings,
      reasoning_summary: result.reasoning_summary,
      quality_score: result.quality_score,
      journalist: result.journalist,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[review-message] error:", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
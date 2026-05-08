// Sprint 2 — Funnemail pipeline (scout → classify → auto-route).
// Estratto 1:1 da index.ts. Fire-and-forget, fail-safe.

import type { ClassifyResult, RequestBody } from "./types.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;
type RecordStage = (stage: string, payload?: Record<string, unknown>, error?: string) => Promise<void> | void;

const internalHeaders = (): Record<string, string> => ({
  "x-internal-token": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
});

export async function runFunnemailScoutAndClassify(
  supabase: Sb,
  body: RequestBody,
  result: ClassifyResult,
  recordStage: RecordStage,
): Promise<void> {
  if (body.channel !== "email") return;
  console.log(JSON.stringify({ dbg: "fnm_pipeline_enter", message_id: body.message_id, has_user: !!body.user_id }));
  try {
    let senderIntel: unknown = null;
    try {
      const { data: scoutData } = await supabase.functions.invoke("funnemail-scout-sender", {
        headers: internalHeaders(),
        body: {
          from_address: body.from_address,
          message_id: body.message_id,
          user_id: body.user_id ?? null,
          force: false,
        },
      });
      console.log(JSON.stringify({ dbg: "fnm_scout_done", message_id: body.message_id, hasData: !!scoutData }));
      if (scoutData) {
        const sd = scoutData as { known?: boolean; partner_id?: string | null; intel?: Record<string, unknown> | null };
        senderIntel = {
          known: !!sd.known,
          partner_id: sd.partner_id ?? null,
          company_type: sd.intel?.company_type ?? null,
          country: sd.intel?.country ?? null,
          website: sd.intel?.website ?? null,
          role_guess: sd.intel?.role_guess ?? null,
        };
        void recordStage("scouted", { known: !!sd.known });
      }
    } catch (se) { console.log(JSON.stringify({ dbg: "fnm_scout_err", err: String(se) })); }

    const cls = await supabase.functions.invoke("funnemail-classify", {
      headers: internalHeaders(),
      body: {
        message_id: body.message_id,
        from_address: body.from_address,
        subject: body.subject || "",
        body_text: body.body_text || "",
        partner_id: body.partner_id || null,
        user_id: body.user_id ?? null,
        prior_classification: result.classification,
        prior_intent: result.intent,
        sender_intel: senderIntel,
      },
    });
    console.log(JSON.stringify({ dbg: "fnm_classify_done", message_id: body.message_id, err: cls?.error ? String(cls.error) : null }));
    void recordStage("classified");
  } catch (e) { console.log(JSON.stringify({ dbg: "fnm_pipeline_err", err: String(e) })); }
}

export async function runFunnemailAutoRoute(
  supabase: Sb,
  body: RequestBody,
  recordStage: RecordStage,
): Promise<void> {
  if (body.channel !== "email" || !body.user_id) return;
  console.log(JSON.stringify({ dbg: "fnm_route_enter", message_id: body.message_id }));
  try {
    const r = await supabase.functions.invoke("funnemail-auto-route", {
      headers: internalHeaders(),
      body: {
        message_id: body.message_id,
        from_address: body.from_address,
        subject: body.subject || "",
        body_text: body.body_text || "",
        user_id: body.user_id,
      },
    });
    console.log(JSON.stringify({ dbg: "fnm_route_done", message_id: body.message_id, err: r?.error ? String(r.error) : null }));
    void recordStage("routed");
  } catch (e) { console.log(JSON.stringify({ dbg: "fnm_route_err", err: String(e) })); }
}
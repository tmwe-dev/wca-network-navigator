/**
 * funnemail-reminders-tick
 *
 * Cron tick (1 min) che marca i reminder Funnemail come "due" e
 * registra una riga in `funnemail_actions_log` (action='reminder_due')
 * per propagare l'evento alla UI via realtime.
 *
 * Estensione audit Funnemail Cr5 — escalation multilivello:
 *  L1 = reminder al claim owner (gestito dal record reminder esistente).
 *  L2 = se job non preso in carico entro `escalation_l2_minutes` (default 30 min)
 *       per urgenze high/critical → riga `funnemail_escalation_events` level=L2
 *       + log azione `escalation_l2`.
 *  L3 = se ancora non preso dopo `escalation_l3_minutes` (default 120 min)
 *       → riga level=L3 + log azione `escalation_l3` (la dispatch alert vera
 *       resta delegata al consumer realtime).
 *
 * Idempotente: usa per chiave (message_id + reminder id) la presenza di
 * triggered_at per non rieseguire. Per le escalation usa il vincolo
 * UNIQUE (message_id, level) della tabella `funnemail_escalation_events`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";

interface ReminderRow {
  id: string;
  message_id: string;
  group_id: string | null;
  remind_at: string;
  note: string | null;
  user_id: string;
}

interface EscalationCandidate {
  message_id: string;
  user_id: string;
  group_id: string | null;
  status: string;
  has_active_claim: boolean;
  ai_urgency: string | null;
  status_changed_at: string | null;
  last_escalation_level: string | null;
}

const DEFAULT_L2_MINUTES = 30;
const DEFAULT_L3_MINUTES = 120;

function minutesSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / 60000);
}

function isUrgent(urgency: string | null | undefined): boolean {
  const u = (urgency ?? "").toLowerCase();
  return u === "high" || u === "critical" || u === "urgent";
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("origin"));

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const { data, error } = await supabase
    .from("funnemail_message_reminders")
    .select("id, message_id, group_id, remind_at, note, user_id")
    .lte("remind_at", nowIso)
    .is("triggered_at", null)
    .is("dismissed_at", null)
    .is("deleted_at", null)
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rows = (data ?? []) as ReminderRow[];
  let processed = 0;
  const errors: string[] = [];

  for (const r of rows) {
    // Mark triggered (idempotency guard)
    const { error: updErr } = await supabase
      .from("funnemail_message_reminders")
      .update({ triggered_at: nowIso })
      .eq("id", r.id)
      .is("triggered_at", null);
    if (updErr) {
      errors.push(`update ${r.id}: ${updErr.message}`);
      continue;
    }

    // Log action so UI listening to funnemail_actions_log realtime sees it
    const { error: logErr } = await supabase.from("funnemail_actions_log").insert({
      message_id: r.message_id,
      group_id: r.group_id,
      action: "reminder_due",
      status: "ok",
      payload: { reminder_id: r.id, note: r.note, remind_at: r.remind_at },
      user_id: r.user_id,
    });
    if (logErr) errors.push(`log ${r.id}: ${logErr.message}`);
    else processed += 1;
  }

  // ---- Escalation L2/L3 (Cr5) ----
  // Cerca job aperti, non presi in carico, urgenti, fermi da troppo tempo.
  let escalations_l2 = 0;
  let escalations_l3 = 0;
  try {
    const { data: candidates } = await supabase
      .from("funnemail_jobs_v")
      .select(
        "message_id,user_id,group_id,status,has_active_claim,ai_urgency,status_changed_at,last_escalation_level",
      )
      .in("status", ["nuovo", "in_lavorazione", "in_attesa", "da_smistare"])
      .eq("has_active_claim", false)
      .limit(500);

    const list = (candidates ?? []) as EscalationCandidate[];
    // Pre-fetch per-user thresholds (cached per request).
    const cfgCache = new Map<string, { l2: number; l3: number }>();
    async function thresholds(userId: string): Promise<{ l2: number; l3: number }> {
      const hit = cfgCache.get(userId);
      if (hit) return hit;
      let l2 = DEFAULT_L2_MINUTES;
      let l3 = DEFAULT_L3_MINUTES;
      try {
        const { data: cfg } = await supabase
          .from("funnemail_routing_config")
          .select("escalation_l2_minutes,escalation_l3_minutes")
          .eq("user_id", userId)
          .maybeSingle();
        if (typeof cfg?.escalation_l2_minutes === "number") l2 = cfg.escalation_l2_minutes;
        if (typeof cfg?.escalation_l3_minutes === "number") l3 = cfg.escalation_l3_minutes;
      } catch (_) { /* fail-safe defaults */ }
      const v = { l2, l3 };
      cfgCache.set(userId, v);
      return v;
    }

    for (const c of list) {
      if (!isUrgent(c.ai_urgency)) continue;
      const ageMin = minutesSince(c.status_changed_at, nowMs);
      const { l2, l3 } = await thresholds(c.user_id);

      const wantLevel: "L2" | "L3" | null =
        ageMin >= l3 && c.last_escalation_level !== "L3" ? "L3" :
        ageMin >= l2 && !c.last_escalation_level ? "L2" : null;
      if (!wantLevel) continue;

      const { error: insErr } = await supabase.from("funnemail_escalation_events").insert({
        message_id: c.message_id,
        user_id: c.user_id,
        level: wantLevel,
        reason: `unclaimed for ${Math.round(ageMin)} min, urgency=${c.ai_urgency ?? "n/a"}`,
        payload: {
          status: c.status,
          group_id: c.group_id,
          age_minutes: Math.round(ageMin),
          ai_urgency: c.ai_urgency,
        },
      });
      // dup key (uq_fee_message_level) → già escalato, ok ignorare
      if (insErr && !String(insErr.message).includes("duplicate key")) {
        errors.push(`escalation ${c.message_id}@${wantLevel}: ${insErr.message}`);
        continue;
      }
      if (!insErr) {
        await supabase.from("funnemail_actions_log").insert({
          message_id: c.message_id,
          group_id: c.group_id,
          action: wantLevel === "L3" ? "escalation_l3" : "escalation_l2",
          status: "ok",
          payload: { age_minutes: Math.round(ageMin), urgency: c.ai_urgency },
          user_id: c.user_id,
        });
        if (wantLevel === "L3") escalations_l3 += 1;
        else escalations_l2 += 1;
      }
    }
  } catch (e) {
    errors.push(`escalation_block: ${e instanceof Error ? e.message : String(e)}`);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      scanned: rows.length,
      processed,
      escalations_l2,
      escalations_l3,
      errors,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
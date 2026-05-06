/**
 * funnemail-reminders-tick
 *
 * Cron tick (1 min) che marca i reminder Funnemail come "due" e
 * registra una riga in `funnemail_actions_log` (action='reminder_due')
 * per propagare l'evento alla UI via realtime.
 *
 * Idempotente: usa per chiave (message_id + reminder id) la presenza di
 * triggered_at per non rieseguire.
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

  return new Response(
    JSON.stringify({ ok: true, scanned: rows.length, processed, errors }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
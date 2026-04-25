import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isOutsideWorkHours, loadWorkHourSettings } from "../_shared/timeUtils.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { cronGuardCheck, cronGuardLogRun } from "../_shared/cronGuard.ts";


/**
 * Email Cron Sync — runs every 5 minutes via pg_cron.
 * Finds all users with IMAP sync state and calls check-inbox for each.
 * Uses shared work-hours logic (CET timezone, reads from app_settings).
 */
Deno.serve(async (req: Request) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ━━━ Cron Guard ━━━
  const guard = await cronGuardCheck(supabase, {
    jobName: "email_sync",
    enabledKey: "cron_email_sync_enabled",
    intervalKey: "cron_email_sync_interval_min",
    defaultIntervalMin: 15,
  });
  if (guard.skip) {
    return new Response(
      JSON.stringify({ skipped: true, reason: guard.reason, next_in_min: (guard as any).nextInMin }),
      { headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }

  try {
    // Find all users with sync state (they have IMAP configured)
    const { data: syncUsers, error: syncErr } = await supabase
      .from("email_sync_state")
      .select("user_id")
      .order("last_sync_at", { ascending: true, nullsFirst: true })
      .limit(10);

    if (syncErr) throw syncErr;
    if (!syncUsers || syncUsers.length === 0) {
      await cronGuardLogRun(supabase, "email_sync", { processed: 0, message: "No users with IMAP configured" });
      return new Response(JSON.stringify({ message: "No users with IMAP configured" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const results: { userId: string; status: string; downloaded?: number }[] = [];

    for (const { user_id } of syncUsers) {
      try {
        // Per-user work-hours check
        const { workStartHour, workEndHour } = await loadWorkHourSettings(supabase, user_id);
        if (isOutsideWorkHours(workStartHour, workEndHour)) {
          results.push({ userId: user_id, status: `skipped: outside work hours (${workStartHour}-${workEndHour})` });
          continue;
        }
        const checkRes = await fetch(`${supabaseUrl}/functions/v1/check-inbox`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
            "x-sync-user-id": user_id,
          },
          body: JSON.stringify({}),
        });

        if (checkRes.ok) {
          const data = await checkRes.json();
          results.push({
            userId: user_id,
            status: "ok",
            downloaded: data.downloaded || 0,
          });
        } else {
          const errText = await checkRes.text();
          results.push({ userId: user_id, status: `error: ${checkRes.status}` });
        }
      } catch (err: Record<string, unknown>) {
        results.push({ userId: user_id, status: `error: ${err.message}` });
      }
    }

    // Update last_sync_at for processed users
    for (const r of results) {
      if (r.status === "ok") {
        await supabase
          .from("email_sync_state")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("user_id", r.userId);
      }
    }


    await cronGuardLogRun(supabase, "email_sync", { processed: results.length });
    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (err: Record<string, unknown>) {
    await cronGuardLogRun(supabase, "email_sync", {}, String(err.message ?? err));
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});

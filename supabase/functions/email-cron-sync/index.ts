import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isOutsideWorkHours, loadWorkHourSettings } from "../_shared/timeUtils.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { cronGuardCheck, cronGuardLogRun } from "../_shared/cronGuard.ts";


/**
 * Email Cron Sync — runs every 10 minutes via pg_cron.
 *
 * Mailbox-aware: itera per (user_id, mailbox_id) leggendo da `email_sync_state`
 * e auto-iscrive le caselle CONDIVISE attive (`shared_mailboxes`) assegnando
 * un operatore qualsiasi con accesso (`operator_mailbox_access`).
 * Le caselle personali esistenti (mailbox_id IS NULL) restano sincronizzate.
 *
 * Usa shared work-hours logic (CET timezone, reads from app_settings).
 * NON modifica `check-inbox` né le sue dipendenze.
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
    defaultIntervalMin: 10,
  });
  if (guard.skip) {
    return new Response(
      JSON.stringify({ skipped: true, reason: guard.reason, next_in_min: (guard as any).nextInMin }),
      { headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }

  try {
    // ━━━ B) Auto-enroll: caselle CONDIVISE attive ━━━
    // Per ogni shared mailbox attiva con credenziali IMAP, assicuriamo che
    // esista almeno una riga in email_sync_state. Assegniamo come "user_id
    // tecnico" un operatore qualsiasi con accesso (operator_mailbox_access).
    try {
      const { data: sharedMboxes } = await supabase
        .from("shared_mailboxes")
        .select("id, imap_host")
        .eq("is_active", true)
        .is("deleted_at", null);

      for (const mbox of sharedMboxes ?? []) {
        if (!mbox.imap_host) continue;
        // Esiste già una riga sync_state per questa mailbox?
        const { data: existing } = await supabase
          .from("email_sync_state")
          .select("user_id")
          .eq("mailbox_id", mbox.id)
          .limit(1)
          .maybeSingle();
        if (existing) continue;

        // Trova un operatore con accesso
        const { data: access } = await supabase
          .from("operator_mailbox_access")
          .select("operator_id")
          .eq("shared_mailbox_id", mbox.id)
          .limit(1)
          .maybeSingle();
        let ownerUserId = access?.operator_id as string | undefined;

        // Fallback: nessun operatore con accesso esplicito → usa il primo
        // admin (o, se non esiste, un operator qualsiasi). Così Amministrazione
        // & co. vengono sincronizzate dal cron senza richiedere assegnazioni.
        if (!ownerUserId) {
          const { data: admin } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("operator_role", "admin")
            .limit(1)
            .maybeSingle();
          ownerUserId = admin?.user_id as string | undefined;
        }
        if (!ownerUserId) {
          const { data: anyOp } = await supabase
            .from("profiles")
            .select("user_id")
            .limit(1)
            .maybeSingle();
          ownerUserId = anyOp?.user_id as string | undefined;
        }
        if (!ownerUserId) continue;

        await supabase.from("email_sync_state").insert({
          user_id: ownerUserId,
          mailbox_id: mbox.id,
          last_uid: 0,
          last_sync_at: null,
        });
      }
    } catch (e) {
      console.warn("[email-cron-sync] shared mailbox auto-enroll failed:", e);
    }

    // ━━━ A) Itera per (user_id, mailbox_id) ━━━
    const { data: syncRows, error: syncErr } = await supabase
      .from("email_sync_state")
      .select("user_id, mailbox_id, last_sync_at")
      .order("last_sync_at", { ascending: true, nullsFirst: true })
      .limit(50);

    if (syncErr) throw syncErr;
    if (!syncRows || syncRows.length === 0) {
      await cronGuardLogRun(supabase, "email_sync", { processed: 0, message: "No mailboxes to sync" });
      return new Response(JSON.stringify({ message: "No mailboxes to sync" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const results: {
      userId: string;
      mailboxId: string | null;
      status: string;
      downloaded?: number;
    }[] = [];

    for (const row of syncRows) {
      const userId = row.user_id as string;
      const mailboxId = (row.mailbox_id as string | null) ?? null;
      try {
        const { workStartHour, workEndHour } = await loadWorkHourSettings(supabase, userId);
        if (isOutsideWorkHours(workStartHour, workEndHour)) {
          results.push({
            userId,
            mailboxId,
            status: `skipped: outside work hours (${workStartHour}-${workEndHour})`,
          });
          continue;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          "x-sync-user-id": userId,
        };
        if (mailboxId) headers["x-mailbox-id"] = mailboxId;

        const checkRes = await fetch(`${supabaseUrl}/functions/v1/check-inbox`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });

        if (checkRes.ok) {
          const data = await checkRes.json();
          results.push({
            userId,
            mailboxId,
            status: "ok",
            downloaded: data.downloaded || 0,
          });
        } else {
          results.push({ userId, mailboxId, status: `error: ${checkRes.status}` });
        }
      } catch (err: Record<string, unknown>) {
        results.push({ userId, mailboxId, status: `error: ${err.message}` });
      }
    }

    // Update last_sync_at per (user_id, mailbox_id) processato con successo
    for (const r of results) {
      if (r.status !== "ok") continue;
      let q = supabase
        .from("email_sync_state")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", r.userId);
      q = r.mailboxId ? q.eq("mailbox_id", r.mailboxId) : q.is("mailbox_id", null);
      await q;
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

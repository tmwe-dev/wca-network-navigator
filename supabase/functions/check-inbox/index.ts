/**
 * check-inbox/index.ts — Thin orchestrator.
 * Imports from: imapConnection, messageProcessor, postProcessing.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";

import {
  createImapConfig,
  connectToImap,
  selectInbox,
  handleUidvalidityChange,
  fetchUidBatch,
  getSyncState,
  skipDuplicateUid,
  updateSyncState,
} from "./imapConnection.ts";
import { processMessage, matchResponseActivity } from "./messageProcessor.ts";
import { applyEmailRules, classifyInboundEmails, buildResponsePayload } from "./postProcessing.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { headers: dynCors });

  const metrics = startMetrics("check-inbox");
  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return edgeError("AUTH_REQUIRED", "Unauthorized", undefined, dynCors);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const syncUserId = req.headers.get("x-sync-user-id");
    const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}` && syncUserId;

    let supabase: ReturnType<typeof createClient>;
    let supabaseAdmin: ReturnType<typeof createClient>;
    let userId: string;

    if (isServiceRoleCall) {
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
      supabase = supabaseAdmin;
      userId = syncUserId;
    } else {
      supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) return edgeError("AUTH_INVALID", "Unauthorized");
      userId = claimsData.claims.sub as string;
    }

    // LOVABLE-93: global pause check
    const { data: pauseSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_automations_paused")
      .eq("user_id", userId)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    if ((pauseSettings as any)?.value === "true") {
      return new Response(JSON.stringify({ paused: true, message: "AI automations paused" }), {
        headers: dynCors,
        status: 200,
      });
    }

    // ── IMAP config ──
    const imapHost = Deno.env.get("IMAP_HOST") || "";
    const imapUser = Deno.env.get("IMAP_USER") || "";
    const imapPassword = Deno.env.get("IMAP_PASSWORD") || "";
    if (!imapHost || !imapUser || !imapPassword) throw new Error("IMAP credentials not configured");

    // ── Get sync state ──
    const syncState = await getSyncState(supabase, userId, imapHost, imapUser);
    let lastUid = syncState.lastUid;
    let storedUidvalidity = syncState.storedUidvalidity;

    // ── Connect to IMAP ──
    const imapConfig = await createImapConfig(imapHost, imapUser, imapPassword);
    const client = await connectToImap(imapConfig);
    const { uidvalidity } = await selectInbox(client);

    // Handle UIDVALIDITY change
    const uidvalidityReset = await handleUidvalidityChange(supabase, userId, storedUidvalidity, uidvalidity);
    if (uidvalidityReset === 0 && storedUidvalidity !== null && storedUidvalidity !== uidvalidity) {
      lastUid = 0;
      storedUidvalidity = uidvalidity;
    } else if (uidvalidity && storedUidvalidity !== uidvalidity) {
      storedUidvalidity = uidvalidity;
    }

    // ── Fetch UID batch ──
    const imapExec = client as unknown as { executeCommand(cmd: string): Promise<(string | Uint8Array)[]> };
    const batch = await fetchUidBatch(imapExec, lastUid);
    const { uids, remainingCount, hasMore } = batch;


    const messages: Record<string, unknown>[] = [];
    let maxUid = lastUid;

    // ── Process each UID ──
    for (const uid of uids) {

      // Skip if already in DB
      if (await skipDuplicateUid(supabase, userId, uid)) {
        maxUid = uid;
        continue;
      }

      // Process message
      const { msgData, error } = await processMessage(
        uid,
        uidvalidity,
        userId,
        imapExec,
        client,
        supabase,
        supabaseAdmin,
        false, // isOversized determined inside processMessage now
      );

      if (error === "duplicate_by_hash" || error === "duplicate_by_message_id") {
        maxUid = uid;
        await updateSyncState(supabase, userId, uid);
        continue;
      }

      if (error === "no_operator") {
        continue;
      }

      if (msgData) {
        messages.push(msgData);
        maxUid = uid;

        // ── Response matching (best-effort) ──
        try {
          const inReplyTo = (msgData as Record<string, unknown>).in_reply_to as string | null;
          const threadId = (msgData as Record<string, unknown>).thread_id as string;
          const match = (msgData as Record<string, unknown>).match as { partnerId?: string } | null;
          await matchResponseActivity(supabase, msgData.id as string, inReplyTo, threadId, match);
        } catch (matchErr: unknown) {
        }
      } else if (error) {
        if (uid > maxUid) {
          maxUid = uid;
          await updateSyncState(supabase, userId, uid);
        }
      }
    }

    try {
      client.disconnect();
    } catch (e: unknown) {
      console.debug("disconnect skipped:", extractErrorMessage(e));
    }

    // ── Post-sync operations (best-effort, fire-and-forget) ──
    await applyEmailRules(supabase, supabaseUrl, serviceRoleKey, userId, messages);
    await classifyInboundEmails(supabaseUrl, serviceRoleKey, userId, messages);

    // ── Response ──
    const responsePayload = buildResponsePayload(messages, maxUid, remainingCount, hasMore);
    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify(responsePayload), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    logEdgeError("check-inbox", err);
    endMetrics(metrics, false, 500);
    return edgeError("INTERNAL_ERROR", extractErrorMessage(err), undefined, dynCors);
  }
});

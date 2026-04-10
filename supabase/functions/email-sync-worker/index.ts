import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Email Sync Worker — server-side autonomous email download.
 *
 * Called by pg_cron every minute (or manually).
 * Finds running sync jobs, invokes check-inbox for each user,
 * and updates the job progress. Loops for up to 50 seconds
 * to maximize throughput within one invocation.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Auth check: require valid Bearer token ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  // Validate the token: accept service_role or valid user JWT
  const token = authHeader.replace("Bearer ", "");
  if (token !== serviceRoleKey) {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Find all running sync jobs
    const { data: jobs, error: jobsErr } = await supabase
      .from("email_sync_jobs")
      .select("*")
      .eq("status", "running")
      .order("created_at", { ascending: true });

    if (jobsErr) throw jobsErr;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No running jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const MAX_WALL_CLOCK_MS = 50_000; // 50 seconds budget
    const startTime = Date.now();

    for (const job of jobs) {
      if (Date.now() - startTime > MAX_WALL_CLOCK_MS) break;

      // Get the user's session token via service role impersonation
      // We call check-inbox directly with the service role key and user context
      let batchesProcessed = 0;
      let totalDownloaded = job.downloaded_count || 0;
      let totalSkipped = job.skipped_count || 0;
      let lastError: string | null = null;
      let errorCount = job.error_count || 0;
      let consecutiveErrors = 0;
      const MAX_CONSECUTIVE_ERRORS = 5;

      // Loop: process batches for this job until time runs out
      while (Date.now() - startTime < MAX_WALL_CLOCK_MS) {
        // Re-check job status (might have been paused by user)
        const { data: freshJob } = await supabase
          .from("email_sync_jobs")
          .select("status")
          .eq("id", job.id)
          .single();

        if (!freshJob || freshJob.status !== "running") {
          console.log(`[sync-worker] Job ${job.id} no longer running, stopping`);
          break;
        }

        try {
          // Call check-inbox for this user
          const checkRes = await fetch(`${supabaseUrl}/functions/v1/check-inbox`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              "x-sync-user-id": job.user_id,
            },
            body: JSON.stringify({ user_id: job.user_id }),
          });

          if (!checkRes.ok) {
            const errBody = await checkRes.json().catch(() => ({ error: `HTTP ${checkRes.status}` }));
            throw new Error(errBody.error || `HTTP ${checkRes.status}`);
          }

          const result = await checkRes.json();
          consecutiveErrors = 0;
          batchesProcessed++;

          const hasMore = typeof result.has_more === "boolean"
            ? result.has_more
            : typeof result.remaining === "number"
              ? result.remaining > 0
              : result.total > 0;

          const serverRemaining = typeof result.remaining === "number" ? result.remaining : 0;

          if (result.total > 0) {
            totalDownloaded += result.total;
          } else {
            totalSkipped++;
          }

          // Update job progress
          await supabase
            .from("email_sync_jobs")
            .update({
              downloaded_count: totalDownloaded,
              skipped_count: totalSkipped,
              total_remaining: serverRemaining,
              last_batch_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", job.id);

          if (!hasMore) {
            // Job complete!
            await supabase
              .from("email_sync_jobs")
              .update({
                status: "completed",
                downloaded_count: totalDownloaded,
                skipped_count: totalSkipped,
                total_remaining: 0,
                completed_at: new Date().toISOString(),
              })
              .eq("id", job.id);

            console.log(`[sync-worker] Job ${job.id} completed: ${totalDownloaded} downloaded, ${totalSkipped} skipped`);
            break;
          }

          // Small delay between batches
          await new Promise((r) => setTimeout(r, 200));
        } catch (err: any) {
          consecutiveErrors++;
          errorCount++;
          lastError = err.message;
          console.warn(`[sync-worker] Job ${job.id} batch error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err.message}`);

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            await supabase
              .from("email_sync_jobs")
              .update({
                status: "error",
                error_message: `${MAX_CONSECUTIVE_ERRORS} errori consecutivi: ${lastError}`,
                error_count: errorCount,
                downloaded_count: totalDownloaded,
                skipped_count: totalSkipped,
              })
              .eq("id", job.id);

            console.error(`[sync-worker] Job ${job.id} failed after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
            break;
          }

          // Update error info but keep running
          await supabase
            .from("email_sync_jobs")
            .update({
              error_message: `Errore temporaneo (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${lastError}`,
              error_count: errorCount,
            })
            .eq("id", job.id);

          // Exponential backoff
          await new Promise((r) => setTimeout(r, 2000 * consecutiveErrors));
        }
      }

      results.push({
        job_id: job.id,
        user_id: job.user_id,
        batches: batchesProcessed,
        downloaded: totalDownloaded,
        skipped: totalSkipped,
      });
    }

    return new Response(JSON.stringify({ processed: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[sync-worker] Fatal error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

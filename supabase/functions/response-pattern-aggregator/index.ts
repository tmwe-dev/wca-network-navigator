/**
 * Response Pattern Aggregator
 * Analyzes email response patterns and aggregates them into response_patterns table.
 * Generates kb_entries for high-confidence patterns.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

interface PatternKey {
  user_id: string;
  country_code: string | null;
  channel: string;
  email_type: string | null;
}

interface PatternStats {
  total_sent: number;
  total_responses: number;
  response_times: number[];
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all email activities from last 90 days with partner info
    const { data: activities, error: actErr } = await supabase
      .from("activities")
      .select("user_id, partner_id, activity_type, response_received, response_time_hours, sent_at, email_subject, source_meta")
      .eq("activity_type", "send_email")
      .gte("sent_at", ninetyDaysAgo)
      .not("user_id", "is", null)
      .limit(1000);

    if (actErr) {
      console.error("Failed to fetch activities:", actErr.message);
      return new Response(JSON.stringify({ error: actErr.message }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    if (!activities?.length) {
      return new Response(JSON.stringify({ patterns_updated: 0, kb_entries_created: 0, total_analyzed: 0 }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Get partner country codes for grouping
    const partnerIds = [...new Set(activities.filter(a => a.partner_id).map(a => a.partner_id as string))];
    const partnerCountryMap: Record<string, string> = {};
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from("partners")
        .select("id, country_code")
        .in("id", partnerIds.slice(0, 500));
      if (partners) {
        for (const p of partners) {
          partnerCountryMap[p.id] = p.country_code || "XX";
        }
      }
    }

    // Aggregate by (user_id, country_code, channel, email_type)
    const patternMap = new Map<string, PatternKey & PatternStats>();

    for (const act of activities) {
      const userId = act.user_id as string;
      const countryCode = act.partner_id ? (partnerCountryMap[act.partner_id as string] || null) : null;
      const channel = "email";
      const emailType = (act.source_meta as Record<string, unknown>)?.email_type as string | null || null;

      const key = `${userId}|${countryCode || ""}|${channel}|${emailType || ""}`;

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          user_id: userId,
          country_code: countryCode,
          channel,
          email_type: emailType,
          total_sent: 0,
          total_responses: 0,
          response_times: [],
        });
      }

      const p = patternMap.get(key)!;
      p.total_sent++;
      if (act.response_received) {
        p.total_responses++;
        if (act.response_time_hours != null) {
          p.response_times.push(Number(act.response_time_hours));
        }
      }
    }

    let patternsUpdated = 0;
    let kbEntriesCreated = 0;

    for (const pattern of patternMap.values()) {
      if (pattern.total_sent < 2) continue;

      const avgResponseTime = pattern.response_times.length > 0
        ? Math.round((pattern.response_times.reduce((a, b) => a + b, 0) / pattern.response_times.length) * 10) / 10
        : null;

      const responseRate = pattern.total_sent > 0
        ? (pattern.total_responses / pattern.total_sent) * 100
        : 0;

      // Calculate confidence
      let confidence = 0.3 + Math.min(pattern.total_sent / 100, 0.2);
      if (responseRate > 30 && pattern.total_sent >= 5) confidence = 0.7;
      else if (responseRate > 20 && pattern.total_sent >= 10) confidence = 0.6;
      confidence = Math.min(confidence, 1);

      // Upsert response_patterns
      const { data: existing } = await supabase
        .from("response_patterns")
        .select("id")
        .eq("user_id", pattern.user_id)
        .eq("channel", pattern.channel)
        .is("country_code", pattern.country_code === null ? null : undefined as unknown as null)
        .limit(1);

      // More precise query for non-null country_code
      let matchId: string | null = null;
      if (pattern.country_code) {
        const { data: exact } = await supabase
          .from("response_patterns")
          .select("id")
          .eq("user_id", pattern.user_id)
          .eq("channel", pattern.channel)
          .eq("country_code", pattern.country_code)
          .eq("email_type", pattern.email_type || "")
          .limit(1);
        matchId = exact?.[0]?.id || null;
      } else {
        matchId = existing?.[0]?.id || null;
      }

      if (matchId) {
        await supabase
          .from("response_patterns")
          .update({
            total_sent: pattern.total_sent,
            total_responses: pattern.total_responses,
            avg_response_time_hours: avgResponseTime,
            pattern_confidence: confidence,
            last_success_at: pattern.total_responses > 0 ? new Date().toISOString() : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchId);
      } else {
        await supabase
          .from("response_patterns")
          .insert({
            user_id: pattern.user_id,
            country_code: pattern.country_code,
            channel: pattern.channel,
            email_type: pattern.email_type,
            total_sent: pattern.total_sent,
            total_responses: pattern.total_responses,
            avg_response_time_hours: avgResponseTime,
            pattern_confidence: confidence,
            last_success_at: pattern.total_responses > 0 ? new Date().toISOString() : null,
            tags: [pattern.country_code, pattern.channel, pattern.email_type].filter(Boolean) as string[],
          });
      }
      patternsUpdated++;

      // Generate kb_entry for high-confidence patterns
      if (confidence >= 0.6) {
        const title = `Pattern: ${pattern.country_code || "Global"} ${pattern.channel} ${pattern.email_type || "general"} — ${Math.round(responseRate)}% response rate`;
        const content = [
          `Response Pattern Analysis:`,
          `- Country: ${pattern.country_code || "Global"}`,
          `- Channel: ${pattern.channel}`,
          `- Type: ${pattern.email_type || "general"}`,
          `- Emails sent: ${pattern.total_sent}`,
          `- Responses received: ${pattern.total_responses}`,
          `- Response rate: ${Math.round(responseRate)}%`,
          `- Avg response time: ${avgResponseTime != null ? `${avgResponseTime}h` : "N/A"}`,
          `- Confidence: ${Math.round(confidence * 100)}%`,
        ].join("\n");

        const tags = ["response_pattern", pattern.country_code, pattern.channel, pattern.email_type, "auto_generated"].filter(Boolean) as string[];
        const priority = confidence > 0.7 ? 7 : 5;

        // Check for existing kb_entry
        const { data: existingKb } = await supabase
          .from("kb_entries")
          .select("id")
          .eq("user_id", pattern.user_id)
          .ilike("title", `Pattern: ${pattern.country_code || "Global"} ${pattern.channel}%`)
          .limit(1);

        if (existingKb?.length) {
          await supabase
            .from("kb_entries")
            .update({ content, priority, tags, updated_at: new Date().toISOString() })
            .eq("id", existingKb[0].id);
        } else {
          await supabase
            .from("kb_entries")
            .insert({
              user_id: pattern.user_id,
              category: "communication_pattern",
              title,
              content,
              tags,
              priority,
              is_active: true,
            });
          kbEntriesCreated++;
        }
      }
    }

    console.log(`[response-pattern-aggregator] Done: ${patternsUpdated} patterns, ${kbEntriesCreated} kb entries, ${activities.length} analyzed`);

    return new Response(JSON.stringify({
      patterns_updated: patternsUpdated,
      kb_entries_created: kbEntriesCreated,
      total_analyzed: activities.length,
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("response-pattern-aggregator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});

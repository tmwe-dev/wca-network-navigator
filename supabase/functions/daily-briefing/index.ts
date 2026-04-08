import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, AiGatewayError, mapErrorToResponse } from "../_shared/aiGateway.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  try {
    const now = new Date();
    const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 1. Download jobs last 24h
    const { data: recentJobs } = await supabase
      .from("download_jobs")
      .select("id, status, country_name, contacts_found_count, error_message")
      .gte("created_at", h24ago)
      .order("created_at", { ascending: false })
      .limit(20);

    const activeJobs = recentJobs?.filter(j => ["running", "pending"].includes(j.status)) ?? [];
    const completedJobs = recentJobs?.filter(j => j.status === "completed") ?? [];
    const failedJobs = recentJobs?.filter(j => j.status === "failed") ?? [];

    // 2. Partners without email
    const { count: noEmailCount } = await supabase
      .from("partners")
      .select("*", { count: "exact", head: true })
      .is("email", null);

    // 3. Partners without profile description (truly incomplete profiles)
    const { count: noProfileCount } = await supabase
      .from("partners")
      .select("*", { count: "exact", head: true })
      .or("profile_description.is.null,profile_description.eq.");

    // 4. Activities due today/overdue
    const { data: dueActivities } = await supabase
      .from("activities")
      .select("id, title, due_date, status, priority")
      .lte("due_date", tomorrow)
      .not("status", "in", '("completed","cancelled")')
      .order("due_date")
      .limit(20);

    const overdue = dueActivities?.filter(a => a.due_date && a.due_date < today) ?? [];
    const dueToday = dueActivities?.filter(a => a.due_date === today) ?? [];

    // 5. Agent tasks
    const { data: agentTasks } = await supabase
      .from("agent_tasks")
      .select("id, agent_id, status, description, completed_at")
      .gte("created_at", h24ago)
      .order("created_at", { ascending: false })
      .limit(50);

    // 6. Agents
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, avatar_emoji, is_active")
      .eq("is_active", true);

    // Build agent status
    const agentStatus = (agents ?? []).map(agent => {
      const tasks = agentTasks?.filter(t => t.agent_id === agent.id) ?? [];
      return {
        id: agent.id,
        name: agent.name,
        emoji: agent.avatar_emoji,
        activeTasks: tasks.filter(t => ["pending", "running"].includes(t.status)).length,
        completedToday: tasks.filter(t => t.status === "completed").length,
        lastTask: tasks.find(t => t.status === "completed")?.description || null,
      };
    });

    // 7. Email queue
    const { count: pendingEmails } = await supabase
      .from("email_campaign_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: sentEmails } = await supabase
      .from("email_campaign_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", h24ago);

    // Build context for LLM
    const context = {
      download: {
        active: activeJobs.length,
        completed24h: completedJobs.length,
        failed24h: failedJobs.length,
        totalContactsFound: completedJobs.reduce((s, j) => s + (j.contacts_found_count || 0), 0),
        failedCountries: failedJobs.map(j => j.country_name).join(", "),
      },
      partners: { total: 12286, withoutEmail: noEmailCount ?? 0, withoutProfile: noProfileCount ?? 0 },
      activities: { overdue: overdue.length, dueToday: dueToday.length, topOverdue: overdue.slice(0, 3).map(a => a.title) },
      agents: agentStatus.filter(a => a.activeTasks > 0 || a.completedToday > 0),
      email: { pending: pendingEmails ?? 0, sent24h: sentEmails ?? 0 },
    };

    // Call LLM via centralized gateway
    let content = "{}";
    try {
      const r = await aiChat({
        models: ["google/gemini-2.5-flash-lite", "openai/gpt-4o-mini"],
        messages: [
          {
            role: "system",
            content: `Sei il direttore operativo di un sistema CRM per freight forwarding. Genera un briefing operativo in italiano.
Rispondi SOLO con un JSON valido, senza markdown o backtick. Formato:
{
  "summary": "testo markdown con max 5 punti prioritari usando bullet points (•). Sii conciso e operativo.",
  "actions": [array di max 3 oggetti {"label": "testo bottone corto", "agentName": "nome agente o null", "prompt": "prompt completo da inviare all'AI"}]
}
I nomi degli agenti disponibili sono: ${agents?.map(a => a.name).join(", ")}.
Suggerisci azioni concrete basate sui dati. Se non ci sono anomalie, suggerisci azioni proattive.`,
          },
          { role: "user", content: `Dati operativi attuali:\n${JSON.stringify(context, null, 2)}` },
        ],
        timeoutMs: 25000,
        maxRetries: 1,
        context: "daily-briefing",
      });
      content = r.content || "{}";
    } catch (err) {
      console.error("daily-briefing LLM error:", err instanceof AiGatewayError ? err.kind : err);
      // Fallback: return raw data without AI summary
      return new Response(JSON.stringify({
        summary: `• **${activeJobs.length}** download attivi, **${completedJobs.length}** completati nelle ultime 24h\n• **${noEmailCount ?? 0}** partner senza email\n• **${overdue.length}** attività scadute, **${dueToday.length}** in scadenza oggi\n• **${pendingEmails ?? 0}** email in coda`,
        actions: [],
        agentStatus,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed: { summary: string; actions: any[] };
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { summary: content, actions: [] };
    }

    return new Response(JSON.stringify({
      summary: parsed.summary || "",
      actions: parsed.actions || [],
      agentStatus,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("daily-briefing error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

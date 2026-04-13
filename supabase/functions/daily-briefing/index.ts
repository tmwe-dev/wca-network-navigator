import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, AiGatewayError } from "../_shared/aiGateway.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

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

    // 3. Partners without profile description
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

    // 8. Holding pattern stats
    const { count: holdingPartners } = await supabase
      .from("partners")
      .select("*", { count: "exact", head: true })
      .eq("lead_status", "contacted");

    const { count: holdingContacts } = await supabase
      .from("imported_contacts")
      .select("*", { count: "exact", head: true })
      .eq("lead_status", "contacted");

    const inHolding = (holdingPartners ?? 0) + (holdingContacts ?? 0);

    const { count: newPartners } = await supabase
      .from("partners")
      .select("*", { count: "exact", head: true })
      .eq("lead_status", "new");

    const { count: newContacts } = await supabase
      .from("imported_contacts")
      .select("*", { count: "exact", head: true })
      .eq("lead_status", "new");

    const notContacted = (newPartners ?? 0) + (newContacts ?? 0);

    // 9. Total contacts
    const { count: totalPartners } = await supabase
      .from("partners")
      .select("*", { count: "exact", head: true });
    const { count: totalImported } = await supabase
      .from("imported_contacts")
      .select("*", { count: "exact", head: true });
    const totalContacts = (totalPartners ?? 0) + (totalImported ?? 0);

    // 10. Scheduled for today (tasks with scheduled_at = today)
    const { count: scheduledToday } = await supabase
      .from("agent_tasks")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_at", today)
      .lt("scheduled_at", tomorrow)
      .in("status", ["pending", "running"]);

    // 11. Unread messages from holding pattern contacts
    const { count: unreadMessages } = await supabase
      .from("channel_messages")
      .select("*", { count: "exact", head: true })
      .is("read_at", null)
      .eq("direction", "inbound");

    // 12. Pending supervisor reviews
    const { count: pendingReviews } = await supabase
      .from("agent_tasks")
      .select("*", { count: "exact", head: true })
      .eq("task_type", "supervisor_review")
      .eq("status", "pending");

    // 13. Operative strategy
    const { data: strategyRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "operative_strategy")
      .maybeSingle();
    let strategyHint = "";
    if (strategyRow?.value) {
      try {
        const s = JSON.parse(strategyRow.value);
        strategyHint = `Regole operative: max ${s.dailyContactLimit} contatti/giorno, follow-up a +${s.followUpDays}gg, escalation a +${s.escalationDays}gg, max ${s.messageMaxLines} righe per messaggio, tono: ${s.toneOfVoice?.slice(0, 80)}`;
      } catch {}
    }

    const stats = { totalContacts, inHolding, notContacted, scheduledToday: scheduledToday ?? 0 };

    // Build context for LLM
    const context = {
      download: {
        active: activeJobs.length,
        completed24h: completedJobs.length,
        failed24h: failedJobs.length,
        totalContactsFound: completedJobs.reduce((s, j) => s + (j.contacts_found_count || 0), 0),
        failedCountries: failedJobs.map(j => j.country_name).join(", "),
      },
      partners: { total: totalContacts, withoutEmail: noEmailCount ?? 0, withoutProfile: noProfileCount ?? 0 },
      holdingPattern: { inHolding, notContacted, unreadMessages: unreadMessages ?? 0 },
      activities: { overdue: overdue.length, dueToday: dueToday.length, topOverdue: overdue.slice(0, 3).map(a => a.title) },
      agents: agentStatus.filter(a => a.activeTasks > 0 || a.completedToday > 0),
      email: { pending: pendingEmails ?? 0, sent24h: sentEmails ?? 0 },
      supervisorReviews: pendingReviews ?? 0,
      scheduledToday: scheduledToday ?? 0,
    };

    // Call LLM via centralized gateway
    let content = "{}";
    try {
      const r = await aiChat({
        models: ["google/gemini-2.5-flash-lite", "openai/gpt-5-mini"],
        messages: [
          {
            role: "system",
            content: `Sei il direttore operativo di un sistema CRM per freight forwarding. Genera un briefing operativo in italiano diviso in 3 sezioni.
${strategyHint ? `\n${strategyHint}\n` : ""}
Rispondi SOLO con un JSON valido, senza markdown o backtick. Formato:
{
  "completed": "markdown con bullet points (•) — lavoro svolto nelle ultime 24h: email inviate, task completati dagli agenti, contatti processati",
  "todo": "markdown — task da effettuare oggi: contatti assegnati, follow-up programmati, contatti non ancora nel circuito da contattare",
  "suspended": "markdown — attività sospese, messaggi in attesa di revisione, strategia per domani e prossimi giorni, ricerca da programmare",
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
        completed: `• **${completedJobs.length}** download completati\n• **${sentEmails ?? 0}** email inviate`,
        todo: `• **${dueToday.length}** attività in scadenza oggi\n• **${notContacted}** contatti da contattare\n• **${scheduledToday ?? 0}** task programmati`,
        suspended: `• **${overdue.length}** attività scadute\n• **${pendingReviews ?? 0}** revisioni in attesa\n• **${unreadMessages ?? 0}** messaggi non letti`,
        actions: [],
        agentStatus,
        stats,
      }), { headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    let parsed: { completed?: string; todo?: string; suspended?: string; summary?: string; actions: Array<Record<string, unknown>> };
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { completed: content, todo: "", suspended: "", actions: [] };
    }

    return new Response(JSON.stringify({
      completed: parsed.completed || "",
      todo: parsed.todo || "",
      suspended: parsed.suspended || "",
      summary: parsed.summary || "",
      actions: parsed.actions || [],
      agentStatus,
      stats,
    }), { headers: { ...dynCors, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("daily-briefing error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});

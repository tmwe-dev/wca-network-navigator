import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCETHour, isOutsideWorkHours } from "../_shared/timeUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Defaults — overridden by app_settings at runtime
const DEFAULT_BUDGET_PER_AGENT = 10;
const DEFAULT_CYCLE_LOOKBACK_MINUTES = 12;
const DEFAULT_WORK_START_HOUR = 6;
const DEFAULT_WORK_END_HOUR = 24; // midnight

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// getCETHour and isOutsideWorkHours are imported from _shared/timeUtils.ts (line 3)
// No local redeclaration — single source of truth for work-hours logic

// Configurable high-stakes criteria — loaded from app_settings at runtime
interface HighStakesCriteria {
  statuses: string[];
  sources: string[];
  min_rating: number;
}

const DEFAULT_HIGH_STAKES: HighStakesCriteria = {
  statuses: ["in_progress", "negotiation"],
  sources: ["ex_client"],
  min_rating: 4,
};

function isHighStakes(item: any, criteria: HighStakesCriteria = DEFAULT_HIGH_STAKES): boolean {
  if (criteria.statuses.includes(item.lead_status)) return true;
  if (criteria.sources.includes(item.source)) return true;
  if (item.rating && item.rating >= criteria.min_rating) return true;
  return false;
}

const DELAY_BETWEEN_AGENTS_MS = 3000;

async function findAgentForPartner(userId: string, partnerId: string, agents: any[]): Promise<any | null> {
  // Check client_assignments first
  const { data: assignment } = await supabase
    .from("client_assignments")
    .select("agent_id")
    .eq("source_id", partnerId)
    .eq("user_id", userId)
    .maybeSingle();

  if (assignment?.agent_id) {
    return agents.find(a => a.id === assignment.agent_id) || null;
  }

  // Check territory match via partner country
  const { data: partner } = await supabase
    .from("partners")
    .select("country_code")
    .eq("id", partnerId)
    .single();

  if (partner?.country_code) {
    const cc = partner.country_code.toUpperCase();
    const territoryAgent = agents.find(a =>
      Array.isArray(a.territory_codes) && a.territory_codes.some((t: string) => t.toUpperCase() === cc)
    );
    if (territoryAgent) return territoryAgent;
  }

  return null;
}

async function screenIncomingMessages(userId: string, agents: any[], budgetPerAgent: number, forceApproval: boolean, hsCriteria: HighStakesCriteria = DEFAULT_HIGH_STAKES): Promise<number> {
  let actionsCreated = 0;
  const lookback = new Date(Date.now() - DEFAULT_CYCLE_LOOKBACK_MINUTES * 60 * 1000).toISOString();

  // Get unread inbound messages from last cycle window
  const { data: messages } = await supabase
    .from("channel_messages")
    .select("id, from_address, subject, body_text, partner_id, channel, email_date, created_at")
    .eq("user_id", userId)
    .eq("direction", "inbound")
    .is("read_at", null)
    .gte("created_at", lookback)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!messages || messages.length === 0) return 0;

  // Filter out messages that already have agent_tasks
  const msgIds = messages.map(m => m.id);
  const { data: existingTasks } = await supabase
    .from("agent_tasks")
    .select("target_filters")
    .eq("user_id", userId)
    .in("task_type", ["analysis", "screening"]);

  const alreadyProcessedIds = new Set(
    (existingTasks || [])
      .map(t => (t.target_filters as any)?.message_id)
      .filter(Boolean)
  );

  const salesAgents = agents.filter(a => ["outreach", "sales", "account"].includes(a.role));
  const fallbackAgent = salesAgents[0] || agents[0];

  for (const msg of messages) {
    if (alreadyProcessedIds.has(msg.id)) continue;
    if (actionsCreated >= budgetPerAgent) break;

    let assignedAgent = fallbackAgent;
    let stakes = false;

    // Find the right agent for this message
    if (msg.partner_id) {
      const found = await findAgentForPartner(userId, msg.partner_id, salesAgents);
      if (found) assignedAgent = found;

      // Check if high stakes
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status, rating")
        .eq("id", msg.partner_id)
        .single();

      if (partner) {
        stakes = isHighStakes(partner, hsCriteria);
      }
    }

    const channelLabel = msg.channel === "whatsapp" ? "WhatsApp" : "Email";
    const senderInfo = msg.from_address || "sconosciuto";
    const subjectInfo = msg.subject ? `"${msg.subject}"` : "(nessun oggetto)";

    await supabase.from("agent_tasks").insert({
      agent_id: assignedAgent.id,
      user_id: userId,
      task_type: "screening",
      description: `📨 ${channelLabel} da ${senderInfo}: ${subjectInfo}. ${stakes ? "⚠️ HIGH-STAKES: richiede approvazione." : "Analisi e risposta suggerita."}`,
      target_filters: {
        message_id: msg.id,
        partner_id: msg.partner_id,
        channel: msg.channel,
        auto_approved: !stakes && !forceApproval,
      } as any,
      status: (stakes || forceApproval) ? "proposed" : "pending",
    });
    actionsCreated++;
  }

  return actionsCreated;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Load configurable settings from app_settings ──
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "agent_max_actions_per_cycle",
        "agent_work_start_hour",
        "agent_work_end_hour",
        "agent_require_approval",
        "high_stakes_statuses",
        "high_stakes_sources",
        "high_stakes_min_rating",
      ]);
    const cfg: Record<string, string> = {};
    settingsRows?.forEach((row: any) => { if (row.value) cfg[row.key] = row.value; });

    const budgetPerAgent = parseInt(cfg["agent_max_actions_per_cycle"] || String(DEFAULT_BUDGET_PER_AGENT), 10);
    const workStartHour = parseInt(cfg["agent_work_start_hour"] || String(DEFAULT_WORK_START_HOUR), 10);
    const workEndHour = parseInt(cfg["agent_work_end_hour"] || String(DEFAULT_WORK_END_HOUR), 10);
    const forceApproval = cfg["agent_require_approval"] === "true";

    // Build configurable high-stakes criteria
    const highStakesCriteria: HighStakesCriteria = {
      statuses: cfg["high_stakes_statuses"] ? cfg["high_stakes_statuses"].split(",").map((s: string) => s.trim()) : DEFAULT_HIGH_STAKES.statuses,
      sources: cfg["high_stakes_sources"] ? cfg["high_stakes_sources"].split(",").map((s: string) => s.trim()) : DEFAULT_HIGH_STAKES.sources,
      min_rating: parseInt(cfg["high_stakes_min_rating"] || String(DEFAULT_HIGH_STAKES.min_rating), 10),
    };

    // Work-hours check (CET timezone)
    if (isOutsideWorkHours(workStartHour, workEndHour)) {
      return new Response(JSON.stringify({ message: `Outside work hours (CET ${workStartHour}:00-${workEndHour}:00)`, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users with active agents
    const { data: allAgents } = await supabase.from("agents").select("id, user_id, name, role, territory_codes, is_active").eq("is_active", true);
    if (!allAgents || allAgents.length === 0) {
      return new Response(JSON.stringify({ message: "No active agents" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group by user
    const userAgents: Record<string, typeof allAgents> = {};
    for (const a of allAgents) {
      if (!userAgents[a.user_id]) userAgents[a.user_id] = [];
      userAgents[a.user_id].push(a);
    }

    const results: any[] = [];

    for (const [userId, agents] of Object.entries(userAgents)) {
      // ═══ PHASE 1: Screen incoming messages (email + WhatsApp) ═══
      const screeningCount = await screenIncomingMessages(userId, agents, budgetPerAgent, forceApproval);
      if (screeningCount > 0) {
        results.push({ phase: "screening", user_id: userId, actions_created: screeningCount });
        await sleep(DELAY_BETWEEN_AGENTS_MS);
      }

      // ═══ PHASE 2: Process agents sequentially (existing logic) ═══
      for (const agent of agents) {
        if (!["outreach", "sales", "account"].includes(agent.role)) continue;

        let actionsCreated = 0;

        // Check for unread replies from contacts in holding pattern
        const { data: unreadMessages } = await supabase.from("channel_messages")
          .select("id, from_address, subject, body_text, partner_id, email_date")
          .eq("user_id", userId).eq("direction", "inbound").is("read_at", null)
          .order("email_date", { ascending: false }).limit(budgetPerAgent);

        for (const msg of (unreadMessages || [])) {
          if (actionsCreated >= budgetPerAgent) break;

          if (msg.partner_id) {
            const { data: partner } = await supabase.from("partners")
              .select("id, company_name, lead_status, rating")
              .eq("id", msg.partner_id).in("lead_status", ["contacted", "in_progress"]).single();

            if (partner) {
              const stakes = isHighStakes(partner) || forceApproval;
              const taskStatus = stakes ? "proposed" : "pending";

              // Check if task already exists for this message
              const { data: existingTask } = await supabase.from("agent_tasks")
                .select("id")
                .eq("agent_id", agent.id)
                .eq("user_id", userId)
                .contains("target_filters", { message_id: msg.id } as any)
                .maybeSingle();

              if (!existingTask) {
                await supabase.from("agent_tasks").insert({
                  agent_id: agent.id, user_id: userId, task_type: "analysis",
                  description: `Analizza risposta da ${partner.company_name}: "${msg.subject}". ${stakes ? "⚠️ HIGH-STAKES: richiede approvazione." : "Auto-approvato: esegui follow-up."}`,
                  target_filters: { message_id: msg.id, partner_id: partner.id, auto_approved: !stakes && !forceApproval } as any,
                  status: taskStatus,
                });
                actionsCreated++;
              }
            }
          }
        }

        // Check for overdue follow-ups
        const { data: overdueFups } = await supabase.from("activities")
          .select("id, title, partner_id, source_meta, due_date")
          .eq("user_id", userId).eq("status", "pending").eq("activity_type", "follow_up")
          .lt("due_date", new Date().toISOString().split("T")[0])
          .limit(budgetPerAgent - actionsCreated);

        for (const fup of (overdueFups || [])) {
          if (actionsCreated >= budgetPerAgent) break;

          // Check if task already exists
          const { data: existingTask } = await supabase.from("agent_tasks")
            .select("id")
            .eq("agent_id", agent.id)
            .contains("target_filters", { activity_id: fup.id } as any)
            .maybeSingle();

          if (existingTask) continue;

          let stakes = false;
          if (fup.partner_id) {
            const { data: p } = await supabase.from("partners").select("rating, lead_status").eq("id", fup.partner_id).single();
            if (p) stakes = isHighStakes(p);
          }

          const needsApproval = stakes || forceApproval;
          await supabase.from("agent_tasks").insert({
            agent_id: agent.id, user_id: userId, task_type: "follow_up",
            description: `Follow-up scaduto: "${fup.title}". ${needsApproval ? "⚠️ Richiede approvazione Director." : "Auto-approvato."}`,
            target_filters: { activity_id: fup.id, partner_id: fup.partner_id, auto_approved: !needsApproval } as any,
            status: needsApproval ? "proposed" : "pending",
          });
          actionsCreated++;
        }

        results.push({ agent: agent.name, role: agent.role, actions_created: actionsCreated });

        if (actionsCreated > 0) await sleep(DELAY_BETWEEN_AGENTS_MS);
      }
    }

    return new Response(JSON.stringify({ success: true, cycle: new Date().toISOString(), results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("autonomous-cycle error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Errore" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

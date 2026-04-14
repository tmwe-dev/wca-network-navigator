import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

/**
 * [A05] State Counter Consistency
 * Scope: Verify counters match real record counts in DB.
 * Preconditions: Tables with data.
 * Tables: email_drafts, email_campaign_queue, agents, agent_tasks.
 * 
 * email_drafts.sent_count MUST == count of email_campaign_queue with status='sent' for that draft.
 * agents.stats.tasks_completed MUST == count of agent_tasks with status='completed' for that agent.
 */

describe("State Counter Consistency [A05]", () => {
  it("email_drafts.sent_count matches actual sent queue items", async () => {
    const { data: drafts, error: dErr } = await supabase
      .from("email_drafts")
      .select("id, sent_count")
      .gt("sent_count", 0)
      .limit(100);
    if (dErr) throw dErr;
    if (!drafts || drafts.length === 0) return; // No drafts with sent > 0

    for (const draft of drafts) {
      const { count, error: qErr } = await supabase
        .from("email_campaign_queue")
        .select("id", { count: "exact", head: true })
        .eq("draft_id", draft.id)
        .eq("status", "sent");
      if (qErr) throw qErr;

      expect(draft.sent_count).toBe(count ?? 0);
    }
  });

  it("no draft has sent_count > total_count", async () => {
    const { data, error } = await supabase
      .from("email_drafts")
      .select("id, sent_count, total_count")
      .limit(1000);
    if (error) throw error;
    if (!data) return;
    for (const d of data) {
      expect(d.sent_count).toBeLessThanOrEqual(d.total_count);
    }
  });

  it("agents.stats.tasks_completed matches actual completed tasks", async () => {
    const { data: agents, error: aErr } = await supabase
      .from("agents")
      .select("id, stats")
      .limit(100);
    if (aErr) throw aErr;
    if (!agents || agents.length === 0) return;

    for (const agent of agents) {
      const stats = agent.stats as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
      const claimedCompleted = stats?.tasks_completed || 0;
      if (claimedCompleted === 0) continue;

      const { count, error: tErr } = await supabase
        .from("agent_tasks")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agent.id)
        .eq("status", "completed");
      if (tErr) throw tErr;

      expect(claimedCompleted).toBe(count ?? 0);
    }
  });

  it("no queue item is 'sent' without a sent_at timestamp", async () => {
    const { data, error } = await supabase
      .from("email_campaign_queue")
      .select("id, status, sent_at")
      .eq("status", "sent")
      .is("sent_at", null)
      .limit(10);
    if (error) throw error;
    expect(data?.length ?? 0).toBe(0);
  });
});

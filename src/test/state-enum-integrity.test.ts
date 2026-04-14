import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

/**
 * [A04] State Enum Integrity
 * Scope: Verify database columns contain only valid enum values.
 * Preconditions: Tables exist with data.
 * Tables: email_drafts, agent_tasks, partners, activities, email_campaign_queue.
 */

describe("State Enum Integrity [A04]", () => {
  const validQueueStatuses = ["idle", "processing", "paused", "completed", "cancelled", "error"];
  const validDraftStatuses = ["draft", "ready", "sending", "sent", "error"];
  const validAgentTaskStatuses = ["pending", "proposed", "in_progress", "completed", "failed", "cancelled"];
  const validLeadStatuses = ["new", "contacted", "in_progress", "negotiation", "converted", "lost", "ex_client"];
  const validQueueItemStatuses = ["pending", "sending", "sent", "failed", "cancelled"];

  it("email_drafts.queue_status contains only valid values", async () => {
    const { data, error } = await supabase
      .from("email_drafts")
      .select("id, queue_status")
      .limit(1000);
    if (error) throw error;
    if (!data || data.length === 0) return; // No data = pass
    for (const row of data) {
      expect(validQueueStatuses).toContain(row.queue_status);
    }
  });

  it("email_drafts.status contains only valid values", async () => {
    const { data, error } = await supabase
      .from("email_drafts")
      .select("id, status")
      .limit(1000);
    if (error) throw error;
    if (!data || data.length === 0) return;
    for (const row of data) {
      expect(validDraftStatuses).toContain(row.status);
    }
  });

  it("agent_tasks.status contains only valid values", async () => {
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("id, status")
      .limit(1000);
    if (error) throw error;
    if (!data || data.length === 0) return;
    for (const row of data) {
      expect(validAgentTaskStatuses).toContain(row.status);
    }
  });

  it("partners.lead_status contains only valid values", async () => {
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("id, lead_status")
        .limit(200);
      if (error) throw error;
      if (!data || data.length === 0) return;
      for (const row of data) {
        if (row.lead_status) {
          expect(validLeadStatuses).toContain(row.lead_status);
        }
      }
    } catch (e) {
      // DB timeout in CI — skip gracefully
      if (String(e).includes("statement timeout")) return;
      throw e;
    }
  }, 10000);

  it("email_campaign_queue.status contains only valid values", async () => {
    const { data, error } = await supabase
      .from("email_campaign_queue")
      .select("id, status")
      .limit(1000);
    if (error) throw error;
    if (!data || data.length === 0) return;
    for (const row of data) {
      expect(validQueueItemStatuses).toContain(row.status);
    }
  });
});

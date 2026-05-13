/**
 * dispatch-integrity-check tests
 *
 * Verifies 3 scenarios:
 *   1. No executed actions → report with all zeros
 *   2. All coherent → report with zero misses
 *   3. Missing channel_message → correctly detected
 */
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Mock data generators
function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    partner_id: crypto.randomUUID(),
    action_type: "send_email",
    executed_at: new Date().toISOString(),
    status: "executed",
    ...overrides,
  };
}

Deno.test("dispatch-integrity: no executed actions yields zero report", () => {
  const actions: unknown[] = [];
  const report = computeReport(actions, [], [], []);
  assertEquals(report.total_executed, 0);
  assertEquals(report.missing_channel_message, 0);
  assertEquals(report.missing_activity, 0);
  assertEquals(report.missing_partner_touch, 0);
});

Deno.test("dispatch-integrity: all coherent yields zero misses", () => {
  const action = makeAction();
  const channelMessages = [{ partner_id: action.partner_id, direction: "outbound", created_at: action.executed_at }];
  const activities = [{ partner_id: action.partner_id, created_at: action.executed_at }];
  const partners = [{ id: action.partner_id, last_outbound_at: action.executed_at }];

  const report = computeReport([action], channelMessages, activities, partners);
  assertEquals(report.total_executed, 1);
  assertEquals(report.missing_channel_message, 0);
  assertEquals(report.missing_activity, 0);
  assertEquals(report.missing_partner_touch, 0);
});

Deno.test("dispatch-integrity: missing channel_message detected", () => {
  const action = makeAction();
  const channelMessages: unknown[] = []; // nothing
  const activities = [{ partner_id: action.partner_id, created_at: action.executed_at }];
  const partners = [{ id: action.partner_id, last_outbound_at: action.executed_at }];

  const report = computeReport([action], channelMessages, activities, partners);
  assertEquals(report.total_executed, 1);
  assertEquals(report.missing_channel_message, 1);
  assertEquals(report.missing_activity, 0);
  assertEquals(report.missing_partner_touch, 0);
  assertEquals(report.details.length, 1);
  assertEquals(report.details[0].issues.includes("missing_channel_message"), true);
});

// Pure computation logic extracted for testability
function computeReport(
  actions: Record<string, unknown>[],
  channelMessages: Record<string, unknown>[],
  activities: Record<string, unknown>[],
  partners: Record<string, unknown>[],
) {
  let missingChannelMessage = 0;
  let missingActivity = 0;
  let missingPartnerTouch = 0;
  const details: Record<string, unknown>[] = [];

  for (const action of actions) {
    const issues: string[] = [];

    const hasCm = channelMessages.some(
      (cm) => cm.partner_id === action.partner_id && cm.direction === "outbound"
        && new Date(cm.created_at as string) >= new Date(action.executed_at as string),
    );
    if (!hasCm) { missingChannelMessage++; issues.push("missing_channel_message"); }

    const hasAct = activities.some(
      (a) => a.partner_id === action.partner_id
        && new Date(a.created_at as string) >= new Date(action.executed_at as string),
    );
    if (!hasAct) { missingActivity++; issues.push("missing_activity"); }

    const partner = partners.find((p) => p.id === action.partner_id);
    if (!partner?.last_outbound_at || new Date(partner.last_outbound_at as string) < new Date(action.executed_at as string)) {
      missingPartnerTouch++;
      issues.push("missing_partner_touch");
    }

    if (issues.length > 0) {
      details.push({ action_id: action.id, partner_id: action.partner_id, action_type: action.action_type, executed_at: action.executed_at, issues });
    }
  }

  return { total_executed: actions.length, missing_channel_message: missingChannelMessage, missing_activity: missingActivity, missing_partner_touch: missingPartnerTouch, details };
}

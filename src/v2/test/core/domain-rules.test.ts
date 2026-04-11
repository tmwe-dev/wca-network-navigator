/**
 * Domain Rules Tests — STEP 10
 * Tests for agent, campaign, activity rules.
 */

import { describe, it, expect } from "vitest";
import {
  canAcceptTasks,
  coversTerritory,
  agentReadinessScore,
  findAgentForTerritory,
} from "@/v2/core/domain/rules/agent-rules";
import {
  jobStatusCounts,
  campaignCompletionPercent,
  hasRemainingWork,
} from "@/v2/core/domain/rules/campaign-rules";
import {
  isActionable,
  isOverdue,
  countOverdue,
} from "@/v2/core/domain/rules/activity-rules";
import type { Agent, CampaignJob, Activity } from "@/v2/core/domain/entities";
import { agentId, userId, campaignJobId, campaignId, partnerId, activityId } from "@/v2/core/domain/entities";

// ── Fixtures ─────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: agentId("a1"),
    userId: userId("u1"),
    name: "Test Agent",
    role: "sales",
    avatarEmoji: "🤖",
    systemPrompt: "You are a sales agent helping with outreach to logistics partners.",
    isActive: true,
    territoryCodes: ["IT", "DE"],
    assignedTools: [],
    knowledgeBase: [],
    stats: {},
    scheduleConfig: {},
    signatureHtml: null,
    signatureImageUrl: null,
    elevenlabsVoiceId: null,
    elevenlabsAgentId: null,
    voiceCallUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCampaignJob(status: "pending" | "completed" | "skipped" | "in_progress"): CampaignJob {
  return {
    id: campaignJobId("cj1"),
    batchId: campaignId("b1"),
    partnerId: partnerId("p1"),
    companyName: "Test Co",
    countryCode: "IT",
    countryName: "Italy",
    jobType: "email",
    status,
    email: "test@test.com",
    phone: null,
    city: null,
    notes: null,
    assignedTo: null,
    completedAt: null,
    userId: null,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: activityId("act1"),
    partnerId: null,
    assignedTo: null,
    activityType: "send_email",
    title: "Follow up",
    description: null,
    status: "pending",
    priority: "medium",
    dueDate: null,
    completedAt: null,
    scheduledAt: null,
    sourceType: "manual",
    sourceId: "src1",
    sourceMeta: null,
    emailSubject: null,
    emailBody: null,
    reviewed: false,
    sentAt: null,
    userId: null,
    executedByAgentId: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Agent Rules ──────────────────────────────────────────────────────

describe("Agent Rules", () => {
  it("canAcceptTasks returns true for active agents", () => {
    expect(canAcceptTasks(makeAgent())).toBe(true);
    expect(canAcceptTasks(makeAgent({ isActive: false }))).toBe(false);
  });

  it("coversTerritory checks territory codes", () => {
    const agent = makeAgent({ territoryCodes: ["IT", "DE"] });
    expect(coversTerritory(agent, "IT")).toBe(true);
    expect(coversTerritory(agent, "US")).toBe(false);
  });

  it("coversTerritory returns true for global agents", () => {
    const global = makeAgent({ territoryCodes: [] });
    expect(coversTerritory(global, "US")).toBe(true);
  });

  it("agentReadinessScore computes correctly", () => {
    const score = agentReadinessScore(makeAgent());
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("findAgentForTerritory finds matching agent", () => {
    const agents = [
      makeAgent({ id: agentId("a1"), territoryCodes: ["IT"] }),
      makeAgent({ id: agentId("a2"), territoryCodes: ["US"] }),
    ];
    const found = findAgentForTerritory(agents, "US");
    expect(found?.id).toBe("a2");
  });

  it("findAgentForTerritory returns null if none match", () => {
    const agents = [makeAgent({ territoryCodes: ["IT"] })];
    expect(findAgentForTerritory(agents, "JP")).toBeNull();
  });
});

// ── Campaign Rules ───────────────────────────────────────────────────

describe("Campaign Rules", () => {
  it("jobStatusCounts counts correctly", () => {
    const jobs = [
      makeCampaignJob("pending"),
      makeCampaignJob("pending"),
      makeCampaignJob("completed"),
    ];
    const counts = jobStatusCounts(jobs);
    expect(counts.pending).toBe(2);
    expect(counts.completed).toBe(1);
  });

  it("campaignCompletionPercent works", () => {
    const jobs = [
      makeCampaignJob("completed"),
      makeCampaignJob("skipped"),
      makeCampaignJob("pending"),
      makeCampaignJob("pending"),
    ];
    expect(campaignCompletionPercent(jobs)).toBe(50);
  });

  it("campaignCompletionPercent returns 0 for empty", () => {
    expect(campaignCompletionPercent([])).toBe(0);
  });

  it("hasRemainingWork detects pending jobs", () => {
    expect(hasRemainingWork([makeCampaignJob("pending")])).toBe(true);
    expect(hasRemainingWork([makeCampaignJob("completed")])).toBe(false);
  });
});

// ── Activity Rules ───────────────────────────────────────────────────

describe("Activity Rules", () => {
  it("isActionable for pending/in_progress", () => {
    expect(isActionable(makeActivity({ status: "pending" }))).toBe(true);
    expect(isActionable(makeActivity({ status: "in_progress" }))).toBe(true);
    expect(isActionable(makeActivity({ status: "completed" }))).toBe(false);
    expect(isActionable(makeActivity({ status: "cancelled" }))).toBe(false);
  });

  it("isOverdue when dueDate is past", () => {
    expect(isOverdue(makeActivity({ dueDate: "2020-01-01" }))).toBe(true);
    expect(isOverdue(makeActivity({ dueDate: "2099-01-01" }))).toBe(false);
    expect(isOverdue(makeActivity())).toBe(false); // no due date
  });

  it("isOverdue false for completed activities", () => {
    expect(
      isOverdue(makeActivity({ dueDate: "2020-01-01", status: "completed" })),
    ).toBe(false);
  });

  it("countOverdue counts correctly", () => {
    const activities = [
      makeActivity({ dueDate: "2020-01-01" }),
      makeActivity({ dueDate: "2099-01-01" }),
      makeActivity(),
    ];
    expect(countOverdue(activities)).toBe(1);
  });
});

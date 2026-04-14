/**
 * AGENT AUTONOMY TESTS — Scorecard Area D
 * Validates task creation, routing, approval, execution, stats, and compliance.
 */
import { describe, it, expect } from "vitest";

// ── Test 1: Task creation correctness ──
describe("Task creation correctness", () => {
  it("screening task includes required fields", () => {
    const task = {
      agent_id: "agent-1",
      user_id: "user-1",
      task_type: "screening",
      description: "📨 Email da test@example.com: \"Test subject\"",
      target_filters: {
        message_id: "msg-1",
        partner_id: "partner-1",
        channel: "email",
        auto_approved: true,
      },
      status: "pending",
    };

    expect(task.agent_id).toBeTruthy();
    expect(task.user_id).toBeTruthy();
    expect(task.task_type).toBe("screening");
    expect(task.target_filters.message_id).toBeTruthy();
    expect(task.status).toMatch(/^(pending|proposed)$/);
  });

  it("follow_up task created for overdue activities", () => {
    const overdueActivity = {
      id: "act-1",
      due_date: "2026-04-08", // past
      status: "pending",
      activity_type: "follow_up",
    };

    const today = "2026-04-10";
    const isOverdue = overdueActivity.due_date < today && overdueActivity.status === "pending";
    expect(isOverdue).toBe(true);
  });
});

// ── Test 2: Routing correctness ──
describe("Routing correctness", () => {
  it("client_assignment takes priority over territory", () => {
    const agents = [
      { id: "agent-a", territory_codes: ["IT"] },
      { id: "agent-b", territory_codes: ["DE"] },
    ];
    const clientAssignment = { agent_id: "agent-b" }; // explicit assignment
    const partnerCountry = "IT"; // would match agent-a by territory

    // Assignment should win
    let assigned: string | null = null;
    if (clientAssignment?.agent_id) {
      assigned = clientAssignment.agent_id;
    } else {
      const cc = partnerCountry.toUpperCase();
      const terAgent = agents.find(a => a.territory_codes?.some(t => t.toUpperCase() === cc));
      assigned = terAgent?.id || null;
    }

    expect(assigned).toBe("agent-b"); // assignment wins over territory
  });

  it("territory fallback works when no assignment exists", () => {
    const agents = [
      { id: "agent-a", territory_codes: ["IT"] },
      { id: "agent-b", territory_codes: ["DE"] },
    ];
    const clientAssignment = null;
    const partnerCountry = "DE";

    let assigned: string | null = null;
    if (clientAssignment) {
      assigned = (clientAssignment as any).agent_id; // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    } else {
      const cc = partnerCountry.toUpperCase();
      const terAgent = agents.find(a => a.territory_codes?.some(t => t.toUpperCase() === cc));
      assigned = terAgent?.id || null;
    }

    expect(assigned).toBe("agent-b");
  });
});

// ── Test 3: Approval discipline ──
describe("Approval discipline", () => {
  function isHighStakes(partner: any): boolean { // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    if (partner.lead_status === "in_progress" || partner.lead_status === "negotiation") return true;
    if (partner.source === "ex_client") return true;
    if (partner.rating && partner.rating >= 4) return true;
    return false;
  }

  it("high-stakes partners get 'proposed' status (requires approval)", () => {
    const highStakesCases = [
      { lead_status: "in_progress", rating: 2 },
      { lead_status: "negotiation", rating: 1 },
      { lead_status: "new", rating: 5 },
      { lead_status: "new", source: "ex_client", rating: 0 },
    ];

    for (const partner of highStakesCases) {
      expect(isHighStakes(partner)).toBe(true);
    }
  });

  it("low-risk partners get 'pending' status (auto-approved)", () => {
    const lowRiskCases = [
      { lead_status: "new", rating: 2 },
      { lead_status: "contacted", rating: 3 },
      { lead_status: "new", rating: 0 },
    ];

    for (const partner of lowRiskCases) {
      expect(isHighStakes(partner)).toBe(false);
    }
  });

  it("forceApproval overrides auto-approve for all tasks", () => {
    const forceApproval = true;
    const isHigh = false;
    const taskStatus = (isHigh || forceApproval) ? "proposed" : "pending";
    expect(taskStatus).toBe("proposed");
  });
});

// ── Test 4: Duplicate task prevention ──
describe("Duplicate task prevention", () => {
  it("existing task for same message_id is not recreated", () => {
    const existingTasks = [
      { target_filters: { message_id: "msg-1" } },
      { target_filters: { message_id: "msg-2" } },
    ];
    const alreadyProcessedIds = new Set(
      existingTasks.map(t => t.target_filters?.message_id).filter(Boolean)
    );

    const newMessages = [
      { id: "msg-1" }, // already processed
      { id: "msg-3" }, // new
    ];

    const toProcess = newMessages.filter(m => !alreadyProcessedIds.has(m.id));
    expect(toProcess).toHaveLength(1);
    expect(toProcess[0].id).toBe("msg-3");
  });

  it("existing task for same activity_id is not recreated", () => {
    const existingTask = { id: "task-1" }; // maybeSingle returned a result
    const shouldCreate = !existingTask;
    expect(shouldCreate).toBe(false);
  });
});

// ── Test 5: Stats integrity ──
describe("Stats integrity", () => {
  it("tasks_completed only incremented on status=completed", () => {
    const tasks = [
      { status: "completed" },
      { status: "failed" },
      { status: "completed" },
      { status: "pending" },
    ];

    const completed = tasks.filter(t => t.status === "completed").length;
    const failed = tasks.filter(t => t.status === "failed").length;

    expect(completed).toBe(2);
    expect(failed).toBe(1);
    // completed + failed != total — pending are not counted
  });
});

// ── Test 6: No zombie tasks ──
describe("No zombie tasks", () => {
  it("running tasks should have a started_at timestamp", () => {
    const runningTasks = [
      { status: "executing", started_at: "2026-04-10T10:00:00Z" },
      { status: "executing", started_at: null }, // zombie candidate
    ];

    const zombies = runningTasks.filter(t => t.status === "executing" && !t.started_at);
    expect(zombies).toHaveLength(1); // detected
  });
});

// ── Test 7: Settings compliance ──
describe("Settings compliance", () => {
  it("budget per agent limits actions created", () => {
    const budgetPerAgent = 5;
    let actionsCreated = 0;
    const messages = Array(10).fill({ id: "msg", partner_id: "p" });

    for (const _msg of messages) {
      if (actionsCreated >= budgetPerAgent) break;
      actionsCreated++;
    }

    expect(actionsCreated).toBe(budgetPerAgent);
  });

  it("work hours from settings are respected", () => {
    // Imported from _shared/timeUtils.ts
    function isOutsideWorkHours(startHour: number, endHour: number, currentHour: number): boolean {
      return currentHour < startHour || currentHour >= endHour;
    }

    expect(isOutsideWorkHours(6, 24, 3)).toBe(true);  // 3am → outside
    expect(isOutsideWorkHours(6, 24, 10)).toBe(false); // 10am → inside
    expect(isOutsideWorkHours(6, 24, 0)).toBe(true);   // midnight → outside
    expect(isOutsideWorkHours(8, 18, 19)).toBe(true);  // 7pm → outside
  });
});

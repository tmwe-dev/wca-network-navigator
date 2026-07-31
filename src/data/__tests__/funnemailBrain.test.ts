import { describe, it, expect, vi, beforeEach } from "vitest";
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
import { listFunnemailBrain } from "@/data/funnemailBrain";
describe("DAL — funnemailBrain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });
  it("returns brain entries", async () => {
    const entries = [
      {
        message_id: "b1",
        user_id: null,
        channel: "email",
        from_address: null,
        subject: null,
        received_at: "2026-01-01",
        job_stage: null,
        job_attempts: null,
        job_last_error: null,
        job_completed_at: null,
        decision_action: null,
        decision_confidence: null,
        decision_reasoning: null,
        decision_at: null,
        funnemail_status: null,
        funnemail_sub_status: null,
        actions_count: 0,
        actions_ok_count: 0,
        last_action_at: null,
      },
    ];
    mockLimit.mockResolvedValue({ data: entries, error: null });
    const r = await listFunnemailBrain();
    expect(r).toEqual(entries);
  });
  it("returns empty when no entries", async () => {
    const r = await listFunnemailBrain();
    expect(r).toEqual([]);
  });
});

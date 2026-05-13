import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

import { logSupervisorAudit } from "@/data/supervisorAuditLog";

describe("DAL — supervisorAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });
  });

  describe("logSupervisorAudit", () => {
    it("logs an audit entry", async () => {
      await logSupervisorAudit({ action: "cron:run" });
      expect(mockFrom).toHaveBeenCalledWith("supervisor_audit_log");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("does not throw on error (best-effort)", async () => {
      mockInsert.mockResolvedValue({ error: { message: "rls denied" } });
      await expect(logSupervisorAudit({ action: "test" })).resolves.not.toThrow();
    });

    it("passes actor_type and mapped fields", async () => {
      await logSupervisorAudit({
        actor_type: "system",
        action: "dispatch:email_sent",
        target_table: "activities",
        target_id: "a1",
      });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_type: "system",
          action_category: "dispatch",
          action_detail: "email_sent",
          target_type: "activities",
          target_id: "a1",
        }),
      );
    });
  });
});

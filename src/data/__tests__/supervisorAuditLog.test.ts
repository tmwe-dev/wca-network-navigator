import { describe, it, expect, vi, beforeEach } from "vitest";
const mockInsert = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
describe("DAL — supervisorAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });
  });
  it("logs an audit entry", async () => {
    await logSupervisorAudit({ actor_type: "system", category: "cron", action: "run" } as never);
    expect(mockFrom).toHaveBeenCalledWith("supervisor_audit_log");
  });
  it("throws on error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "rls" } });
    await expect(logSupervisorAudit({} as never)).rejects.toEqual({ message: "rls" });
  });
});

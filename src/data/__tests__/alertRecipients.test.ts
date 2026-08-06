import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import {
  listAlertRecipients,
  upsertAlertRecipient,
  deleteAlertRecipient,
  listAlertDispatchLog,
} from "@/data/alertRecipients";

function chain(terminal: { data?: any; error?: any; count?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.insert = vi.fn().mockResolvedValue({ error: terminal.error ?? null });
  c.update = vi.fn().mockReturnValue(c);
  c.delete = vi.fn().mockReturnValue(c);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — alertRecipients", () => {
  describe("listAlertRecipients", () => {
    it("returns recipients for user", async () => {
      const recipients = [
        {
          id: "r1",
          user_id: "u1",
          name: "Test",
          role: null,
          whatsapp_e164: "+1",
          email: null,
          categories: [],
          min_urgency_score: 0,
          is_active: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
          timezone: "UTC",
          notes: null,
          created_at: "t",
          updated_at: "t",
        },
      ];
      mockFrom.mockReturnValue(chain({ data: recipients, error: null }));
      const result = await listAlertRecipients("u1");
      expect(mockFrom).toHaveBeenCalledWith("alert_recipients");
      expect(result.map((r) => r.id)).toEqual(["r1"]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listAlertRecipients("u1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("upsertAlertRecipient", () => {
    it("inserts new recipient (no id)", async () => {
      const c = chain();
      mockFrom.mockReturnValue(c);
      await upsertAlertRecipient("u1", { name: "New", whatsapp_e164: "+1234" });
      expect(c.insert as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });

    it("updates existing recipient (with id)", async () => {
      const c = chain();
      (c.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);
      await upsertAlertRecipient("u1", { id: "r1", name: "Updated", whatsapp_e164: "+1234" });
      expect(mockFrom).toHaveBeenCalledWith("alert_recipients");
    });

    it("throws on insert error", async () => {
      const c = chain();
      (c.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: { message: "fail" } });
      mockFrom.mockReturnValue(c);
      await expect(upsertAlertRecipient("u1", { name: "X", whatsapp_e164: "+1" })).rejects.toEqual({ message: "fail" });
    });
  });

  describe("deleteAlertRecipient", () => {
    it("deletes by id", async () => {
      const c = chain();
      (c.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);
      await deleteAlertRecipient("r1");
      expect(mockFrom).toHaveBeenCalledWith("alert_recipients");
    });
  });

  describe("listAlertDispatchLog", () => {
    it("returns dispatch log entries", async () => {
      const logs = [
        {
          id: "d1",
          user_id: "u1",
          recipient_id: "r1",
          message_id: null,
          channel: "whatsapp",
          business_category: null,
          urgency_score: null,
          alert_categories: null,
          payload: {},
          status: "sent",
          error: null,
          created_at: "t",
        },
      ];
      mockFrom.mockReturnValue(chain({ data: logs, error: null }));
      const result = await listAlertDispatchLog("u1");
      expect(mockFrom).toHaveBeenCalledWith("alert_dispatch_log");
      expect(result.map((l) => l.id)).toEqual(["d1"]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listAlertDispatchLog("u1")).rejects.toEqual({ message: "fail" });
    });
  });
});

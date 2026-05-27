import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (table: string) => mockFrom(table),
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
      const recipients = [{ id: "r1", name: "Test" }];
      mockFrom.mockReturnValue(chain({ data: recipients, error: null }));
      const result = await listAlertRecipients("u1");
      expect(mockFrom).toHaveBeenCalledWith("alert_recipients");
      expect(result).toEqual(recipients);
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
      const logs = [{ id: "d1" }];
      mockFrom.mockReturnValue(chain({ data: logs, error: null }));
      const result = await listAlertDispatchLog("u1");
      expect(mockFrom).toHaveBeenCalledWith("alert_dispatch_log");
      expect(result).toEqual(logs);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listAlertDispatchLog("u1")).rejects.toEqual({ message: "fail" });
    });
  });
});

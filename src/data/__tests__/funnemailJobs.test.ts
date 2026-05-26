import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

import { listFunnemailJobs, getFunnemailJob, setFunnemailSubStatus } from "@/data/funnemailJobs";

function chain(terminal: { data?: any; error?: any } = { data: [], error: null }) {
  const c: Record<string, any> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue(terminal);
  c.then = (resolve: (v: any) => void) => resolve(terminal);
  return c;
}

describe("DAL — funnemailJobs", () => {
  describe("listFunnemailJobs", () => {
    it("returns jobs list", async () => {
      mockFrom.mockReturnValue(chain({ data: [{ message_id: "m1" }], error: null }));
      const result = await listFunnemailJobs();
      expect(result).toEqual([{ message_id: "m1" }]);
    });

    it("returns empty on null data", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      const result = await listFunnemailJobs();
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));
      await expect(listFunnemailJobs()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("getFunnemailJob", () => {
    it("returns single job", async () => {
      const c = chain();
      (c.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { message_id: "m1" }, error: null });
      mockFrom.mockReturnValue(c);
      const result = await getFunnemailJob("m1");
      expect(result).toEqual({ message_id: "m1" });
    });

    it("returns null when not found", async () => {
      const c = chain();
      (c.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);
      const result = await getFunnemailJob("m999");
      expect(result).toBeNull();
    });

    it("throws on error", async () => {
      const c = chain();
      (c.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: "fail" } });
      mockFrom.mockReturnValue(c);
      await expect(getFunnemailJob("m1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("setFunnemailSubStatus", () => {
    it("updates sub_status", async () => {
      mockFrom.mockReturnValue(chain({ error: null }));
      await setFunnemailSubStatus("m1", "awaiting_reply");
      expect(mockFrom).toHaveBeenCalledWith("funnemail_message_status");
    });

    it("throws on error", async () => {
      mockFrom.mockReturnValue(chain({ error: { message: "fail" } }));
      await expect(setFunnemailSubStatus("m1", "x")).rejects.toEqual({ message: "fail" });
    });
  });
});

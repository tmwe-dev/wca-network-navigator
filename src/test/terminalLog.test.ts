import { describe, it, expect } from "vitest";
import { asTerminalLog, toJson, type TerminalLogEntry } from "@/lib/partnerUtils";

describe("terminalLog helpers", () => {
  describe("asTerminalLog", () => {
    it("handles null gracefully", () => {
      expect(asTerminalLog(null)).toEqual([]);
    });

    it("handles undefined gracefully", () => {
      expect(asTerminalLog(undefined)).toEqual([]);
    });

    it("handles non-array types", () => {
      expect(asTerminalLog("string")).toEqual([]);
      expect(asTerminalLog(42)).toEqual([]);
      expect(asTerminalLog({})).toEqual([]);
    });

    it("returns valid log entries", () => {
      const entries = [
        { ts: "10:00:00", type: "INFO", msg: "Test message" },
        { ts: "10:00:01", type: "ERROR", msg: "Error message" },
      ];
      const result = asTerminalLog(entries);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ts: "10:00:00", type: "INFO", msg: "Test message" });
    });
  });

  describe("toJson round-trip", () => {
    it("preserves array content through toJson", () => {
      const entries: TerminalLogEntry[] = [
        { ts: "10:00:00", type: "INFO", msg: "Started" },
      ];
      const json = toJson(entries);
      const back = asTerminalLog(json);
      expect(back).toHaveLength(1);
      expect(back[0].msg).toBe("Started");
    });

    it("preserves nested objects through toJson", () => {
      const obj = { key: "value", nested: { a: 1 } };
      const json = toJson(obj);
      expect(json).toEqual(obj);
    });
  });
});

import { describe, it, expect } from "vitest";
import { nextStatus, STATUS_LABELS, ACTIVITY_TYPE_LABELS, STATUS_CYCLE } from "@/lib/activityConstants";

describe("activityConstants", () => {
  describe("nextStatus", () => {
    it("pending → in_progress", () => {
      expect(nextStatus("pending")).toBe("in_progress");
    });
    it("in_progress → completed", () => {
      expect(nextStatus("in_progress")).toBe("completed");
    });
    it("completed → pending (cycles)", () => {
      expect(nextStatus("completed")).toBe("pending");
    });
    it("unknown status wraps to pending (index -1 + 1 = 0)", () => {
      expect(nextStatus("unknown")).toBe("pending");
    });
  });

  describe("STATUS_LABELS", () => {
    it("has labels for all cycle statuses", () => {
      STATUS_CYCLE.forEach(s => {
        expect(STATUS_LABELS[s]).toBeTruthy();
      });
    });
  });

  describe("ACTIVITY_TYPE_LABELS", () => {
    it("has send_email label", () => {
      expect(ACTIVITY_TYPE_LABELS.send_email).toBe("Email");
    });
    it("has phone_call label", () => {
      expect(ACTIVITY_TYPE_LABELS.phone_call).toBe("Telefono");
    });
  });
});

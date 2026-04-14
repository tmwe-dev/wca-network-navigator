import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_ICONS,
  STATUS_CYCLE,
  JOB_STATUS_ICONS,
  nextStatus,
} from "@/lib/activityConstants";
import { WHATSAPP_EXTENSION_REQUIRED_VERSION } from "@/lib/whatsappExtensionZip";

describe("utils.cn", () => {
  it("merge classi e dedup tailwind", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("ignora valori falsy", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("supporta oggetti condizionali (clsx)", () => {
    expect(cn({ active: true, disabled: false })).toBe("active");
  });

  it("ritorna stringa vuota su input vuoto", () => {
    expect(cn()).toBe("");
  });
});

describe("activityConstants", () => {
  it("ACTIVITY_TYPE_ICONS contiene tutti i tipi attesi", () => {
    expect(ACTIVITY_TYPE_ICONS.send_email).toBeDefined();
    expect(ACTIVITY_TYPE_ICONS.phone_call).toBeDefined();
    expect(ACTIVITY_TYPE_ICONS.meeting).toBeDefined();
    expect(ACTIVITY_TYPE_ICONS.follow_up).toBeDefined();
    expect(ACTIVITY_TYPE_ICONS.add_to_campaign).toBeDefined();
    expect(ACTIVITY_TYPE_ICONS.other).toBeDefined();
  });

  it("ACTIVITY_TYPE_LABELS in italiano", () => {
    expect(ACTIVITY_TYPE_LABELS.send_email).toBe("Email");
    expect(ACTIVITY_TYPE_LABELS.phone_call).toBe("Telefono");
    expect(ACTIVITY_TYPE_LABELS.meeting).toBe("Meeting");
    expect(ACTIVITY_TYPE_LABELS.follow_up).toBe("Follow-up");
  });

  it("STATUS_LABELS / STATUS_ICONS in coppia per ogni status", () => {
    for (const k of Object.keys(STATUS_LABELS)) {
      expect((STATUS_ICONS as any)[k]).toBeDefined(); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    }
  });

  it("STATUS_CYCLE è ['pending','in_progress','completed']", () => {
    expect(STATUS_CYCLE).toEqual(["pending", "in_progress", "completed"]);
  });

  it("JOB_STATUS_ICONS copre i 4 stati job", () => {
    expect(JOB_STATUS_ICONS.pending).toBeDefined();
    expect(JOB_STATUS_ICONS.in_progress).toBeDefined();
    expect(JOB_STATUS_ICONS.completed).toBeDefined();
    expect(JOB_STATUS_ICONS.skipped).toBeDefined();
  });

  describe("nextStatus", () => {
    it("pending → in_progress → completed → pending (ciclo)", () => {
      expect(nextStatus("pending")).toBe("in_progress");
      expect(nextStatus("in_progress")).toBe("completed");
      expect(nextStatus("completed")).toBe("pending");
    });

    it("status sconosciuto riparte da pending", () => {
      // indexOf=-1 → (-1+1)%3 = 0 → STATUS_CYCLE[0] = "pending"
      expect(nextStatus("xyz")).toBe("pending");
      expect(nextStatus("cancelled")).toBe("pending");
    });
  });
});

describe("whatsappExtensionZip constants", () => {
  it("esporta versione richiesta", () => {
    expect(WHATSAPP_EXTENSION_REQUIRED_VERSION).toBe("5.1-csp");
  });
});

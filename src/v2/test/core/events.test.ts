/**
 * Tests: Domain Events
 */
import { describe, it, expect } from "vitest";
import { createEvent } from "../../core/domain/events";

describe("Domain Events", () => {
  it("creates event with all required fields", () => {
    const evt = createEvent("partner.created", { partnerId: "p1" }, "test");
    expect(evt.type).toBe("partner.created");
    expect(evt.payload.partnerId).toBe("p1");
    expect(evt.source).toBe("test");
    expect(evt.timestamp).toBeTruthy();
    expect(evt.correlationId).toMatch(/^evt_/);
  });

  it("uses provided correlationId", () => {
    const evt = createEvent("partner.created", { partnerId: "p1" }, "test", "custom-123");
    expect(evt.correlationId).toBe("custom-123");
  });

  it("generates unique correlationIds", () => {
    const e1 = createEvent("partner.created", { partnerId: "p1" }, "test");
    const e2 = createEvent("partner.created", { partnerId: "p2" }, "test");
    expect(e1.correlationId).not.toBe(e2.correlationId);
  });

  it("events are frozen", () => {
    const evt = createEvent("partner.created", { partnerId: "p1" }, "test");
    expect(Object.isFrozen(evt)).toBe(true);
  });
});

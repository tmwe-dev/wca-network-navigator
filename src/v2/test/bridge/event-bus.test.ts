/**
 * Tests: Event Bus
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  subscribe,
  publish,
  unsubscribe,
  getDeadLetterQueue,
  clearDeadLetterQueue,
  getSubscriptionCount,
  resetBus,
} from "../bridge/event-bus";
import { createEvent } from "../core/domain/events";

beforeEach(() => {
  resetBus();
});

describe("Event Bus", () => {
  it("delivers event to subscriber", async () => {
    let received = false;
    subscribe("partner.created", () => { received = true; });
    await publish(createEvent("partner.created", { partnerId: "p1" }, "test"));
    expect(received).toBe(true);
  });

  it("does not deliver to wrong event type", async () => {
    let received = false;
    subscribe("partner.created", () => { received = true; });
    await publish(createEvent("contact.created", { contactId: "c1" }, "test"));
    expect(received).toBe(false);
  });

  it("unsubscribe removes handler", async () => {
    let count = 0;
    const id = subscribe("partner.created", () => { count++; });
    await publish(createEvent("partner.created", { partnerId: "p1" }, "test"));
    expect(count).toBe(1);

    unsubscribe(id);
    await publish(createEvent("partner.created", { partnerId: "p2" }, "test"));
    expect(count).toBe(1);
  });

  it("tracks subscription count", () => {
    expect(getSubscriptionCount()).toBe(0);
    const id = subscribe("partner.created", () => {});
    expect(getSubscriptionCount()).toBe(1);
    unsubscribe(id);
    expect(getSubscriptionCount()).toBe(0);
  });

  it("sends failed events to DLQ after 3 retries", async () => {
    subscribe("partner.created", () => { throw new Error("handler fail"); });

    const evt = createEvent("partner.created", { partnerId: "p1" }, "test");
    // Publish 3 times to exhaust retries
    await publish(evt);
    await publish(evt);
    await publish(evt);

    const dlq = getDeadLetterQueue();
    expect(dlq.length).toBe(1);
    expect(dlq[0].attempts).toBe(3);
    expect(dlq[0].error).toBe("handler fail");
  });

  it("clearDeadLetterQueue empties DLQ", async () => {
    subscribe("partner.created", () => { throw new Error("fail"); });
    const evt = createEvent("partner.created", { partnerId: "p1" }, "test");
    await publish(evt);
    await publish(evt);
    await publish(evt);

    expect(getDeadLetterQueue().length).toBe(1);
    clearDeadLetterQueue();
    expect(getDeadLetterQueue().length).toBe(0);
  });
});

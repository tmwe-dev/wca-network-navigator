import { describe, it, expect, beforeEach } from "vitest";
import { setGreenZoneDelay, getGreenZoneDelay } from "@/lib/wcaCheckpoint";

vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("wcaCheckpoint", () => {
  beforeEach(() => {
    delete (window as any).__wcaCheckpoint__;
    setGreenZoneDelay(20); // Reset to default
  });

  it("getGreenZoneDelay returns default 20 seconds", () => {
    expect(getGreenZoneDelay()).toBe(20);
  });

  it("setGreenZoneDelay changes the delay", () => {
    setGreenZoneDelay(30);
    expect(getGreenZoneDelay()).toBe(30);
  });

  it("setGreenZoneDelay clamps to minimum 15", () => {
    setGreenZoneDelay(5);
    expect(getGreenZoneDelay()).toBe(15);
  });

  it("setGreenZoneDelay clamps to maximum 60", () => {
    setGreenZoneDelay(120);
    expect(getGreenZoneDelay()).toBe(60);
  });

  it("exports waitForGreenZone function", async () => {
    const mod = await import("@/lib/wcaCheckpoint");
    expect(mod.waitForGreenZone).toBeDefined();
    expect(typeof mod.waitForGreenZone).toBe("function");
  });
});

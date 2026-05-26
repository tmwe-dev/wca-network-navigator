import { describe, it, expect, beforeEach } from "vitest";
import { setGreenZoneDelay, getGreenZoneDelay, isGreenZone, markRequestSent, getElapsedSinceLastRequest } from "@/lib/wcaCheckpoint";

vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("wcaCheckpoint", () => {
  beforeEach(() => {
    delete (window as any).__wcaCheckpoint__;
    setGreenZoneDelay(20);
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

  it("isGreenZone returns true when no requests made", () => {
    expect(isGreenZone()).toBe(true);
  });

  it("markRequestSent updates last request timestamp", () => {
    markRequestSent();
    expect(getElapsedSinceLastRequest()).toBeLessThan(1);
  });
});

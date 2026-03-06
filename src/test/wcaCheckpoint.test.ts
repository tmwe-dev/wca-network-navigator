import { describe, it, expect, beforeEach } from "vitest";
import {
  getElapsedSinceLastRequest,
  isGreenZone,
  markRequestSent,
  setGreenZoneDelay,
  getGreenZoneDelay,
  getLastRequestTimestamp,
} from "@/lib/wcaCheckpoint";

describe("wcaCheckpoint", () => {
  beforeEach(() => {
    // Reset green zone to default
    setGreenZoneDelay(20);
  });

  it("starts in green zone (no previous requests)", () => {
    expect(isGreenZone()).toBe(true);
    expect(getElapsedSinceLastRequest()).toBe(Infinity);
  });

  it("markRequestSent updates the timestamp", () => {
    markRequestSent();
    const ts = getLastRequestTimestamp();
    expect(ts).toBeGreaterThan(0);
    expect(Date.now() - ts).toBeLessThan(100);
  });

  it("is not in green zone immediately after request", () => {
    markRequestSent();
    expect(isGreenZone()).toBe(false);
    expect(getElapsedSinceLastRequest()).toBeLessThan(2);
  });

  it("setGreenZoneDelay clamps values", () => {
    setGreenZoneDelay(10); // Below min
    expect(getGreenZoneDelay()).toBe(15);

    setGreenZoneDelay(100); // Above max
    expect(getGreenZoneDelay()).toBe(60);

    setGreenZoneDelay(30); // Normal
    expect(getGreenZoneDelay()).toBe(30);
  });

  it("getGreenZoneDelay returns current setting", () => {
    setGreenZoneDelay(25);
    expect(getGreenZoneDelay()).toBe(25);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setGreenZoneDelay,
  getGreenZoneDelay,
  getElapsedSinceLastRequest,
  isGreenZone,
  markRequestSent,
  getLastRequestTimestamp,
  waitForGreenLight,
} from "./wcaCheckpoint";

beforeEach(() => {
  // Reset checkpoint state
  delete (window as any).__wcaCheckpoint__;
  setGreenZoneDelay(20); // reset default
});

describe("wcaCheckpoint", () => {
  describe("setGreenZoneDelay / getGreenZoneDelay", () => {
    it("defaults to 20 seconds", () => {
      expect(getGreenZoneDelay()).toBe(20);
    });

    it("clamps minimum to 15", () => {
      setGreenZoneDelay(5);
      expect(getGreenZoneDelay()).toBe(15);
    });

    it("clamps maximum to 60", () => {
      setGreenZoneDelay(100);
      expect(getGreenZoneDelay()).toBe(60);
    });

    it("accepts values within range", () => {
      setGreenZoneDelay(30);
      expect(getGreenZoneDelay()).toBe(30);
    });
  });

  describe("getElapsedSinceLastRequest", () => {
    it("returns Infinity when no request has been sent", () => {
      expect(getElapsedSinceLastRequest()).toBe(Infinity);
    });

    it("returns elapsed seconds after a request", () => {
      markRequestSent();
      expect(getElapsedSinceLastRequest()).toBeLessThanOrEqual(1);
    });
  });

  describe("isGreenZone", () => {
    it("is true when no request has been sent (Infinity elapsed)", () => {
      expect(isGreenZone()).toBe(true);
    });

    it("is false immediately after a request", () => {
      markRequestSent();
      expect(isGreenZone()).toBe(false);
    });
  });

  describe("markRequestSent / getLastRequestTimestamp", () => {
    it("records a timestamp", () => {
      const before = Date.now();
      markRequestSent();
      const after = Date.now();
      const ts = getLastRequestTimestamp();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe("waitForGreenLight", () => {
    it("returns true immediately when no previous request", async () => {
      const result = await waitForGreenLight();
      expect(result).toBe(true);
    });

    it("returns false when aborted", async () => {
      markRequestSent();
      const controller = new AbortController();
      controller.abort();
      const result = await waitForGreenLight(controller.signal);
      expect(result).toBe(false);
    });

    it("calls onWaiting with seconds remaining", async () => {
      vi.useFakeTimers();
      markRequestSent();
      setGreenZoneDelay(15);

      const onWaiting = vi.fn();
      const promise = waitForGreenLight(undefined, onWaiting);

      // Advance past green zone
      await vi.advanceTimersByTimeAsync(16_000);

      const result = await promise;
      expect(result).toBe(true);
      expect(onWaiting).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});

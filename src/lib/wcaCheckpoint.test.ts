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

const CHECKPOINT_KEY = "__wcaCheckpoint__";

describe("wcaCheckpoint", () => {
  beforeEach(() => {
    // Reset global state before each test
    (window as any)[CHECKPOINT_KEY] = { lastRequestTs: 0 };
    setGreenZoneDelay(20); // reset to default
  });

  describe("setGreenZoneDelay / getGreenZoneDelay", () => {
    it("sets and gets the green zone delay", () => {
      setGreenZoneDelay(30);
      expect(getGreenZoneDelay()).toBe(30);
    });

    it("clamps to minimum of 15 seconds", () => {
      setGreenZoneDelay(5);
      expect(getGreenZoneDelay()).toBe(15);
    });

    it("clamps to maximum of 60 seconds", () => {
      setGreenZoneDelay(120);
      expect(getGreenZoneDelay()).toBe(60);
    });
  });

  describe("getElapsedSinceLastRequest", () => {
    it("returns Infinity when no request has been sent", () => {
      expect(getElapsedSinceLastRequest()).toBe(Infinity);
    });

    it("returns elapsed seconds after a request", () => {
      // Set lastRequestTs to 10 seconds ago
      (window as any)[CHECKPOINT_KEY].lastRequestTs = Date.now() - 10_000;
      const elapsed = getElapsedSinceLastRequest();
      expect(elapsed).toBeGreaterThanOrEqual(9);
      expect(elapsed).toBeLessThanOrEqual(11);
    });
  });

  describe("isGreenZone", () => {
    it("returns true when no request has been sent", () => {
      expect(isGreenZone()).toBe(true);
    });

    it("returns false immediately after a request", () => {
      markRequestSent();
      expect(isGreenZone()).toBe(false);
    });

    it("returns true when enough time has elapsed", () => {
      (window as any)[CHECKPOINT_KEY].lastRequestTs = Date.now() - 25_000;
      expect(isGreenZone()).toBe(true);
    });
  });

  describe("markRequestSent", () => {
    it("records the current timestamp", () => {
      const before = Date.now();
      markRequestSent();
      const after = Date.now();
      const ts = getLastRequestTimestamp();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe("getLastRequestTimestamp", () => {
    it("returns 0 when no request has been sent", () => {
      expect(getLastRequestTimestamp()).toBe(0);
    });
  });

  describe("waitForGreenLight", () => {
    it("resolves immediately when no prior request exists", async () => {
      const result = await waitForGreenLight();
      expect(result).toBe(true);
    });

    it("returns false when signal is already aborted", async () => {
      markRequestSent();
      const controller = new AbortController();
      controller.abort();
      const result = await waitForGreenLight(controller.signal);
      expect(result).toBe(false);
    });

    it("resolves true when green zone is already reached", async () => {
      (window as any)[CHECKPOINT_KEY].lastRequestTs = Date.now() - 25_000;
      const result = await waitForGreenLight();
      expect(result).toBe(true);
    });

    it("calls onWaiting callback with remaining seconds", async () => {
      vi.useFakeTimers();
      // Set last request to 19 seconds ago (1 second remaining with 20s green zone)
      (window as any)[CHECKPOINT_KEY].lastRequestTs = Date.now() - 19_000;

      const onWaiting = vi.fn();
      const promise = waitForGreenLight(undefined, onWaiting);

      // Advance past the 1-second poll interval
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe(true);
      expect(onWaiting).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("returns false when aborted during wait", async () => {
      vi.useFakeTimers();
      markRequestSent();

      const controller = new AbortController();
      const promise = waitForGreenLight(controller.signal);

      // Abort after a short delay
      controller.abort();
      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;
      expect(result).toBe(false);

      vi.useRealTimers();
    });
  });
});

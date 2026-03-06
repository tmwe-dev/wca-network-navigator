import { describe, it, expect, beforeEach } from "vitest";
import { RateLimitDetector } from "./rateLimitDetector";

describe("RateLimitDetector", () => {
  let detector: RateLimitDetector;

  beforeEach(() => {
    detector = new RateLimitDetector();
  });

  describe("initial state", () => {
    it("is not rate limited initially", () => {
      expect(detector.isRateLimited()).toBe(false);
    });

    it("detected is false initially", () => {
      expect(detector.detected).toBe(false);
    });

    it("getRecentLengths returns empty array initially", () => {
      expect(detector.getRecentLengths()).toEqual([]);
    });
  });

  describe("recordNotFound", () => {
    it("records HTML lengths", () => {
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      expect(detector.getRecentLengths()).toEqual([5000, 5000]);
    });
  });

  describe("isRateLimited", () => {
    it("returns false with fewer than 3 recordings", () => {
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      expect(detector.isRateLimited()).toBe(false);
    });

    it("returns true when 3 consecutive identical lengths > 1000", () => {
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      expect(detector.isRateLimited()).toBe(true);
    });

    it("returns false when 3 lengths are identical but <= 1000", () => {
      detector.recordNotFound(500);
      detector.recordNotFound(500);
      detector.recordNotFound(500);
      expect(detector.isRateLimited()).toBe(false);
    });

    it("returns false when lengths differ", () => {
      detector.recordNotFound(5000);
      detector.recordNotFound(5001);
      detector.recordNotFound(5000);
      expect(detector.isRateLimited()).toBe(false);
    });

    it("checks only last 3 entries", () => {
      detector.recordNotFound(1000); // different
      detector.recordNotFound(2000); // different
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      expect(detector.isRateLimited()).toBe(true);
    });

    it("stays detected once triggered", () => {
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      expect(detector.isRateLimited()).toBe(true);

      // Record different lengths — should still be detected
      detector.recordNotFound(1);
      detector.recordNotFound(2);
      detector.recordNotFound(3);
      expect(detector.isRateLimited()).toBe(true);
    });
  });

  describe("forceDetected", () => {
    it("forces rate limit state without recordings", () => {
      detector.forceDetected();
      expect(detector.isRateLimited()).toBe(true);
      expect(detector.detected).toBe(true);
    });
  });

  describe("getRecentLengths", () => {
    it("returns last N lengths", () => {
      detector.recordNotFound(100);
      detector.recordNotFound(200);
      detector.recordNotFound(300);
      detector.recordNotFound(400);

      expect(detector.getRecentLengths(2)).toEqual([300, 400]);
      expect(detector.getRecentLengths(3)).toEqual([200, 300, 400]);
    });

    it("returns all lengths when N exceeds recordings", () => {
      detector.recordNotFound(100);
      expect(detector.getRecentLengths(5)).toEqual([100]);
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      detector.recordNotFound(5000);
      expect(detector.isRateLimited()).toBe(true);

      detector.reset();
      expect(detector.isRateLimited()).toBe(false);
      expect(detector.detected).toBe(false);
      expect(detector.getRecentLengths()).toEqual([]);
    });

    it("clears forced detection", () => {
      detector.forceDetected();
      detector.reset();
      expect(detector.detected).toBe(false);
    });
  });
});

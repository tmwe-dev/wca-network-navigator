import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setGreenZoneDelay,
  getGreenZoneDelay,
  getElapsedSinceLastRequest,
  isGreenZone,
  markRequestSent,
  getLastRequestTimestamp,
  waitForGreenLight,
} from "@/lib/wcaCheckpoint";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import { latLngToVector3, easeOutQuart, easeInOutCubic, easeInOutSine } from "@/components/campaigns/globe/utils";

// ─── wcaCheckpoint ───────────────────────────────────────────

describe("wcaCheckpoint — global rate-limit gate", () => {
  beforeEach(() => {
    // Reset state on window
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      delete (window as any).__wcaCheckpoint__;
    }
    setGreenZoneDelay(20); // reset to default
  });

  describe("setGreenZoneDelay / getGreenZoneDelay", () => {
    it("clamp tra 15 e 60 secondi", () => {
      setGreenZoneDelay(5);
      expect(getGreenZoneDelay()).toBe(15);
      setGreenZoneDelay(120);
      expect(getGreenZoneDelay()).toBe(60);
      setGreenZoneDelay(30);
      expect(getGreenZoneDelay()).toBe(30);
    });
  });

  describe("isGreenZone / markRequestSent", () => {
    it("è verde se nessuna richiesta è stata mai fatta", () => {
      expect(isGreenZone()).toBe(true);
      expect(getElapsedSinceLastRequest()).toBe(Infinity);
    });

    it("è rosso subito dopo una richiesta", () => {
      markRequestSent();
      expect(isGreenZone()).toBe(false);
      expect(getElapsedSinceLastRequest()).toBeLessThan(2);
    });

    it("torna verde dopo che è passato il delay", () => {
      vi.useFakeTimers();
      const baseTs = new Date("2026-04-08T10:00:00Z").getTime();
      vi.setSystemTime(baseTs);
      markRequestSent();
      expect(isGreenZone()).toBe(false);

      vi.setSystemTime(baseTs + 21_000); // 21 sec later
      expect(isGreenZone()).toBe(true);
      expect(getElapsedSinceLastRequest()).toBe(21);
      vi.useRealTimers();
    });

    it("getLastRequestTimestamp ritorna 0 inizialmente", () => {
      expect(getLastRequestTimestamp()).toBe(0);
      markRequestSent();
      expect(getLastRequestTimestamp()).toBeGreaterThan(0);
    });
  });

  describe("waitForGreenLight", () => {
    it("ritorna true subito se nessuna richiesta", async () => {
      expect(await waitForGreenLight()).toBe(true);
    });

    it("ritorna false se aborted prima del green", async () => {
      vi.useFakeTimers();
      try {
        markRequestSent();
        const ctrl = new AbortController();
        const promise = waitForGreenLight(ctrl.signal);
        ctrl.abort();
        await vi.advanceTimersByTimeAsync(50);
        expect(await promise).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

// ─── sanitizeSearchTerm ──────────────────────────────────────

describe("sanitizeSearchTerm", () => {
  it("rimuove parentesi, virgole, punti, backslash, *, %, _", () => {
    expect(sanitizeSearchTerm("(hello) ,world.")).toBe("hello world");
    expect(sanitizeSearchTerm("a*b%c_d")).toBe("abcd");
    expect(sanitizeSearchTerm("path\\file")).toBe("pathfile");
  });

  it("preserva spazi e caratteri alfanumerici", () => {
    expect(sanitizeSearchTerm("Mario Rossi 123")).toBe("Mario Rossi 123");
  });

  it("ritorna stringa vuota su input solo speciali", () => {
    expect(sanitizeSearchTerm("().,*%_\\")).toBe("");
  });
});

// ─── globe utils ─────────────────────────────────────────────

describe("campaigns/globe/utils", () => {
  describe("latLngToVector3", () => {
    it("converte (0,0) → (R, 0, 0) sull'equatore meridiano 0", () => {
      // phi=π/2, theta=π → x = -(R·1·-1)=R, y=0, z=R·1·0=0
      const v = latLngToVector3(0, 0, 100);
      expect(v.x).toBeCloseTo(100, 5);
      expect(v.y).toBeCloseTo(0, 5);
      expect(v.z).toBeCloseTo(0, 5);
    });

    it("Polo Nord ha y = +R", () => {
      const v = latLngToVector3(90, 0, 50);
      expect(v.y).toBeCloseTo(50, 5);
    });

    it("Polo Sud ha y = -R", () => {
      const v = latLngToVector3(-90, 0, 50);
      expect(v.y).toBeCloseTo(-50, 5);
    });

    it("vettore risultante ha modulo ≈ R", () => {
      const v = latLngToVector3(45, 45, 100);
      const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      expect(mag).toBeCloseTo(100, 5);
    });
  });

  describe("easing functions", () => {
    it("easeOutQuart(0)=0, (1)=1", () => {
      expect(easeOutQuart(0)).toBe(0);
      expect(easeOutQuart(1)).toBe(1);
    });

    it("easeInOutCubic(0)=0, (0.5)≈0.5, (1)=1", () => {
      expect(easeInOutCubic(0)).toBe(0);
      expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
      expect(easeInOutCubic(1)).toBe(1);
    });

    it("easeInOutSine(0)=0, (0.5)=0.5, (1)=1", () => {
      expect(easeInOutSine(0)).toBeCloseTo(0, 5);
      expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 5);
      expect(easeInOutSine(1)).toBeCloseTo(1, 5);
    });

    it("easing functions sono monotone crescenti", () => {
      const fns = [easeOutQuart, easeInOutCubic, easeInOutSine];
      for (const fn of fns) {
        let prev = -Infinity;
        for (let x = 0; x <= 1; x += 0.1) {
          const y = fn(x);
          expect(y).toBeGreaterThanOrEqual(prev);
          prev = y;
        }
      }
    });
  });
});

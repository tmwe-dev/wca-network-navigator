/**
 * DAL — directoryCache module tests
 */
import { describe, it, expect } from "vitest";
import * as dirCache from "@/data/directoryCache";

describe("DAL — directoryCache", () => {
  it("exports expected functions", () => {
    const exported = Object.keys(dirCache);
    expect(exported.length).toBeGreaterThan(0);
    for (const fn of exported) {
      expect(typeof (dirCache as Record<string, unknown>)[fn]).toBe("function");
    }
  });
});

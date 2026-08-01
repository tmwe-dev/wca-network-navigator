import { describe, it, expect, beforeEach } from "vitest";
import { getDirectory, saveDirectory, createDirectory } from "@/lib/localDirectory";

vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("localDirectory", () => {
  beforeEach(() => { localStorage.clear(); });

  it("getDirectory returns null for non-existent country", () => {
    expect(getDirectory("XX")).toBeNull();
  });

  it("saveDirectory stores and retrieves directory", () => {
    const dir = {
      countryCode: "IT", countryName: "Italy",
      ids: { "1": "pending" as const, "2": "done" as const },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    saveDirectory("IT", dir);
    const result = getDirectory("IT");
    expect(result).not.toBeNull();
    expect(result!.countryCode).toBe("IT");
    expect(result!.ids["1"]).toBe("pending");
  });

  it("createDirectory creates a new directory for country", () => {
    const ids = [100, 200, 300];
    createDirectory("DE", "Germany", ids);
    const result = getDirectory("DE");
    expect(result).not.toBeNull();
    expect(result!.countryCode).toBe("DE");
    expect(Object.keys(result!.ids).length).toBe(3);
  });

  it("multiple directories are independent", () => {
    createDirectory("FR", "France", [10]);
    createDirectory("ES", "Spain", [20]);
    expect(getDirectory("FR")!.ids["10"]).toBe("pending");
    expect(getDirectory("ES")!.ids["20"]).toBe("pending");
  });
});

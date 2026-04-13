import { describe, it, expect, beforeEach } from "vitest";
import { getDirectory, saveDirectory, clearDirectory, type Directory } from "@/lib/localDirectory";

describe("localDirectory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getDirectory returns null for non-existent country", () => {
    expect(getDirectory("XX")).toBeNull();
  });

  it("saveDirectory stores and retrieves directory", () => {
    const dir: Directory = {
      countryCode: "IT",
      countryName: "Italy",
      ids: { "1": "pending", "2": "done" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDirectory(dir);
    const result = getDirectory("IT");
    expect(result).not.toBeNull();
    expect(result!.countryCode).toBe("IT");
    expect(result!.ids["1"]).toBe("pending");
    expect(result!.ids["2"]).toBe("done");
  });

  it("clearDirectory removes stored directory", () => {
    const dir: Directory = {
      countryCode: "DE",
      countryName: "Germany",
      ids: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDirectory(dir);
    expect(getDirectory("DE")).not.toBeNull();
    clearDirectory("DE");
    expect(getDirectory("DE")).toBeNull();
  });

  it("multiple directories are independent", () => {
    saveDirectory({ countryCode: "FR", countryName: "France", ids: { "10": "done" }, createdAt: "", updatedAt: "" });
    saveDirectory({ countryCode: "ES", countryName: "Spain", ids: { "20": "pending" }, createdAt: "", updatedAt: "" });
    expect(getDirectory("FR")!.ids["10"]).toBe("done");
    expect(getDirectory("ES")!.ids["20"]).toBe("pending");
  });
});

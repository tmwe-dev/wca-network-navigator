import { describe, it, expect, beforeEach } from "vitest";
import {
  getDirectory,
  saveDirectory,
  createDirectory,
  markIdDone,
  markIdFailed,
  getPendingIds,
  getDoneCount,
  getTotalCount,
  isCountryCompleted,
  checkMissingIdsLocal,
  getSuspendedJobs,
  saveSuspendedJob,
  removeSuspendedJob,
  getMemberNetworkDomain,
  getAllDirectories,
} from "./localDirectory";

beforeEach(() => {
  localStorage.clear();
});

describe("localDirectory", () => {
  describe("getDirectory / saveDirectory", () => {
    it("returns null for non-existent directory", () => {
      expect(getDirectory("IT")).toBeNull();
    });

    it("saves and retrieves a directory", () => {
      const dir = createDirectory("IT", "Italy", [100, 200]);
      const loaded = getDirectory("IT");
      expect(loaded).not.toBeNull();
      expect(loaded!.countryCode).toBe("IT");
      expect(loaded!.countryName).toBe("Italy");
      expect(Object.keys(loaded!.ids)).toHaveLength(2);
    });
  });

  describe("createDirectory", () => {
    it("creates a directory with all ids pending", () => {
      const dir = createDirectory("DE", "Germany", [1, 2, 3]);
      expect(dir.ids["1"]).toBe("pending");
      expect(dir.ids["2"]).toBe("pending");
      expect(dir.ids["3"]).toBe("pending");
    });

    it("preserves existing status on re-create", () => {
      createDirectory("DE", "Germany", [1, 2, 3]);
      markIdDone("DE", 1);
      const dir = createDirectory("DE", "Germany", [1, 2, 3, 4]);
      expect(dir.ids["1"]).toBe("done");
      expect(dir.ids["4"]).toBe("pending");
    });

    it("stores network map if provided", () => {
      const dir = createDirectory("DE", "Germany", [1, 2], { 1: ["lognet.com"], 2: ["wca-first"] });
      expect(dir.memberNetworks!["1"]).toEqual(["lognet.com"]);
      expect(dir.memberNetworks!["2"]).toEqual(["wca-first"]);
    });
  });

  describe("markIdDone / markIdFailed", () => {
    it("marks an id as done", () => {
      createDirectory("US", "USA", [10, 20]);
      markIdDone("US", 10);
      expect(getDirectory("US")!.ids["10"]).toBe("done");
    });

    it("marks an id as failed", () => {
      createDirectory("US", "USA", [10, 20]);
      markIdFailed("US", 20);
      expect(getDirectory("US")!.ids["20"]).toBe("failed");
    });

    it("does nothing if directory does not exist", () => {
      markIdDone("XX", 1);
      expect(getDirectory("XX")).toBeNull();
    });
  });

  describe("query helpers", () => {
    beforeEach(() => {
      createDirectory("FR", "France", [1, 2, 3, 4, 5]);
      markIdDone("FR", 1);
      markIdDone("FR", 2);
      markIdFailed("FR", 3);
    });

    it("getPendingIds returns only pending", () => {
      expect(getPendingIds("FR")).toEqual([4, 5]);
    });

    it("getDoneCount counts done ids", () => {
      expect(getDoneCount("FR")).toBe(2);
    });

    it("getTotalCount counts all ids", () => {
      expect(getTotalCount("FR")).toBe(5);
    });

    it("isCountryCompleted returns false when pending exist", () => {
      expect(isCountryCompleted("FR")).toBe(false);
    });

    it("isCountryCompleted returns true when no pending", () => {
      markIdDone("FR", 4);
      markIdDone("FR", 5);
      expect(isCountryCompleted("FR")).toBe(true);
    });

    it("returns empty for non-existent country", () => {
      expect(getPendingIds("ZZ")).toEqual([]);
      expect(getDoneCount("ZZ")).toBe(0);
      expect(getTotalCount("ZZ")).toBe(0);
    });
  });

  describe("checkMissingIdsLocal", () => {
    it("returns all ids as missing when no directory exists", () => {
      const result = checkMissingIdsLocal([1, 2, 3], "XX");
      expect(result.missing).toEqual([1, 2, 3]);
      expect(result.found).toBe(0);
    });

    it("returns only non-done ids as missing", () => {
      createDirectory("JP", "Japan", [1, 2, 3]);
      markIdDone("JP", 1);
      markIdDone("JP", 3);
      const result = checkMissingIdsLocal([1, 2, 3], "JP");
      expect(result.missing).toEqual([2]);
      expect(result.found).toBe(2);
    });
  });

  describe("suspended jobs", () => {
    it("returns empty array when no jobs", () => {
      expect(getSuspendedJobs()).toEqual([]);
    });

    it("saves and retrieves suspended job", () => {
      createDirectory("BR", "Brazil", [1, 2, 3]);
      saveSuspendedJob("BR", "Brazil");
      const jobs = getSuspendedJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].countryCode).toBe("BR");
      expect(jobs[0].pendingCount).toBe(3);
    });

    it("removes suspended job", () => {
      createDirectory("BR", "Brazil", [1, 2]);
      saveSuspendedJob("BR", "Brazil");
      removeSuspendedJob("BR");
      expect(getSuspendedJobs()).toEqual([]);
    });

    it("does not save job with no pending ids", () => {
      createDirectory("BR", "Brazil", [1]);
      markIdDone("BR", 1);
      saveSuspendedJob("BR", "Brazil");
      expect(getSuspendedJobs()).toEqual([]);
    });
  });

  describe("getMemberNetworkDomain", () => {
    it("returns null for non-existent directory", () => {
      expect(getMemberNetworkDomain("XX", 1)).toBeNull();
    });

    it("returns own domain over wca- prefix", () => {
      createDirectory("IT", "Italy", [1], { 1: ["wca-first", "lognet.com"] });
      expect(getMemberNetworkDomain("IT", 1)).toBe("lognet.com");
    });

    it("falls back to first network if all are wca-*", () => {
      createDirectory("IT", "Italy", [1], { 1: ["wca-first", "wca-advanced"] });
      expect(getMemberNetworkDomain("IT", 1)).toBe("wca-first");
    });
  });

  describe("getAllDirectories", () => {
    it("returns all saved directories", () => {
      createDirectory("IT", "Italy", [1]);
      createDirectory("DE", "Germany", [2]);
      const dirs = getAllDirectories();
      expect(dirs).toHaveLength(2);
      const codes = dirs.map((d) => d.countryCode).sort();
      expect(codes).toEqual(["DE", "IT"]);
    });
  });
});

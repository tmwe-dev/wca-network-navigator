import { describe, it, expect, beforeEach } from "vitest";
import {
  createDirectory,
  getDirectory,
  saveDirectory,
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
} from "@/lib/localDirectory";

describe("localDirectory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("createDirectory + getDirectory", () => {
    it("crea directory con stati pending iniziali", () => {
      const d = createDirectory("IT", "Italy", [1, 2, 3]);
      expect(d.countryCode).toBe("IT");
      expect(d.ids["1"]).toBe("pending");
      expect(d.ids["2"]).toBe("pending");
      expect(d.ids["3"]).toBe("pending");
      expect(getDirectory("IT")?.ids).toEqual(d.ids);
    });

    it("preserva stati esistenti su ricreazione", () => {
      createDirectory("IT", "Italy", [1, 2]);
      markIdDone("IT", 1);
      const d = createDirectory("IT", "Italy", [1, 2, 3]);
      expect(d.ids["1"]).toBe("done");
      expect(d.ids["2"]).toBe("pending");
      expect(d.ids["3"]).toBe("pending");
    });

    it("salva memberNetworks dal discover", () => {
      const d = createDirectory("IT", "Italy", [1, 2], { 1: ["acme.it"], 2: ["wca-first"] });
      expect(d.memberNetworks?.["1"]).toEqual(["acme.it"]);
    });

    it("ritorna null su getDirectory inesistente", () => {
      expect(getDirectory("ZZ")).toBeNull();
    });
  });

  describe("markIdDone / markIdFailed", () => {
    it("aggiorna lo stato di un id", () => {
      createDirectory("IT", "Italy", [1, 2]);
      markIdDone("IT", 1);
      markIdFailed("IT", 2);
      const d = getDirectory("IT")!;
      expect(d.ids["1"]).toBe("done");
      expect(d.ids["2"]).toBe("failed");
    });

    it("no-op se directory non esiste", () => {
      expect(() => markIdDone("ZZ", 1)).not.toThrow();
      expect(getDirectory("ZZ")).toBeNull();
    });
  });

  describe("query helpers", () => {
    beforeEach(() => {
      createDirectory("IT", "Italy", [1, 2, 3, 4]);
      markIdDone("IT", 1);
      markIdDone("IT", 2);
      markIdFailed("IT", 3);
    });

    it("getPendingIds ritorna solo pending", () => {
      expect(getPendingIds("IT")).toEqual([4]);
    });

    it("getDoneCount conta solo done", () => {
      expect(getDoneCount("IT")).toBe(2);
    });

    it("getTotalCount conta tutti gli id", () => {
      expect(getTotalCount("IT")).toBe(4);
    });

    it("isCountryCompleted false se ci sono pending", () => {
      expect(isCountryCompleted("IT")).toBe(false);
    });

    it("isCountryCompleted true quando tutti finalizzati", () => {
      markIdDone("IT", 4);
      // ID 3 è failed, ma non pending → considerato completato
      expect(isCountryCompleted("IT")).toBe(true);
    });

    it("isCountryCompleted false su country vuoto", () => {
      expect(isCountryCompleted("ZZ")).toBe(false);
    });
  });

  describe("checkMissingIdsLocal", () => {
    it("ritorna tutti gli id come missing se directory non esiste", () => {
      const r = checkMissingIdsLocal([1, 2, 3], "ZZ");
      expect(r.missing).toEqual([1, 2, 3]);
      expect(r.found).toBe(0);
    });

    it("filtra solo gli id non done", () => {
      createDirectory("IT", "Italy", [1, 2, 3]);
      markIdDone("IT", 1);
      markIdDone("IT", 2);
      const r = checkMissingIdsLocal([1, 2, 3, 4], "IT");
      expect(r.missing).toEqual([3, 4]);
      expect(r.found).toBe(2);
    });
  });

  describe("Suspended jobs", () => {
    it("salva job sospeso solo se ci sono pending", () => {
      createDirectory("IT", "Italy", [1, 2]);
      saveSuspendedJob("IT", "Italy");
      const jobs = getSuspendedJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].pendingCount).toBe(2);
      expect(jobs[0].countryCode).toBe("IT");
    });

    it("non salva se nessun pending", () => {
      createDirectory("IT", "Italy", [1]);
      markIdDone("IT", 1);
      saveSuspendedJob("IT", "Italy");
      expect(getSuspendedJobs()).toHaveLength(0);
    });

    it("upsert: rimuove job esistente prima di reinserire", () => {
      createDirectory("IT", "Italy", [1, 2]);
      saveSuspendedJob("IT", "Italy");
      markIdDone("IT", 1);
      saveSuspendedJob("IT", "Italy");
      const jobs = getSuspendedJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].pendingCount).toBe(1);
    });

    it("removeSuspendedJob filtra correttamente", () => {
      createDirectory("IT", "Italy", [1]);
      createDirectory("DE", "Germany", [1]);
      saveSuspendedJob("IT", "Italy");
      saveSuspendedJob("DE", "Germany");
      removeSuspendedJob("IT");
      const jobs = getSuspendedJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].countryCode).toBe("DE");
    });

    it("getSuspendedJobs ritorna [] su storage vuoto", () => {
      expect(getSuspendedJobs()).toEqual([]);
    });
  });

  describe("getMemberNetworkDomain", () => {
    it("ritorna null se directory non esiste", () => {
      expect(getMemberNetworkDomain("ZZ", 1)).toBeNull();
    });

    it("ritorna null se membro non ha networks", () => {
      createDirectory("IT", "Italy", [1]);
      expect(getMemberNetworkDomain("IT", 1)).toBeNull();
    });

    it("preferisce domini own (non wca-*)", () => {
      createDirectory("IT", "Italy", [1], { 1: ["wca-first", "acme.it", "wcaworld.com"] });
      expect(getMemberNetworkDomain("IT", 1)).toBe("acme.it");
    });

    it("fallback al primo se solo wca-*", () => {
      createDirectory("IT", "Italy", [1], { 1: ["wca-first"] });
      expect(getMemberNetworkDomain("IT", 1)).toBe("wca-first");
    });
  });

  describe("getAllDirectories", () => {
    it("ritorna tutte le directory salvate con prefix", () => {
      createDirectory("IT", "Italy", [1]);
      createDirectory("DE", "Germany", [2]);
      createDirectory("FR", "France", [3]);
      const all = getAllDirectories();
      expect(all).toHaveLength(3);
      expect(all.map((d) => d.countryCode).sort()).toEqual(["DE", "FR", "IT"]);
    });

    it("ignora chiavi senza prefix wca_dir_", () => {
      localStorage.setItem("other_key", "garbage");
      createDirectory("IT", "Italy", [1]);
      expect(getAllDirectories()).toHaveLength(1);
    });

    it("ignora entry JSON corrotte", () => {
      localStorage.setItem("wca_dir_BAD", "{not json");
      createDirectory("IT", "Italy", [1]);
      expect(getAllDirectories()).toHaveLength(1);
    });
  });

  describe("saveDirectory", () => {
    it("aggiorna updatedAt", async () => {
      const d = createDirectory("IT", "Italy", [1]);
      const before = d.updatedAt;
      await new Promise((r) => setTimeout(r, 5));
      saveDirectory("IT", d);
      expect(getDirectory("IT")?.updatedAt).not.toBe(before);
    });
  });
});

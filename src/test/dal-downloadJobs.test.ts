/**
 * DAL Download Jobs — Unit tests
 */
import { describe, it, expect } from "vitest";
import * as downloadJobsDAL from "@/data/downloadJobs";

describe("DAL — downloadJobs", () => {
  it("exports all expected functions", () => {
    expect(typeof downloadJobsDAL.findDownloadJobs).toBe("function");
    expect(typeof downloadJobsDAL.getDownloadJob).toBe("function");
    expect(typeof downloadJobsDAL.createDownloadJob).toBe("function");
    expect(typeof downloadJobsDAL.updateDownloadJob).toBe("function");
    expect(typeof downloadJobsDAL.deleteDownloadJob).toBe("function");
    expect(typeof downloadJobsDAL.invalidateDownloadJobs).toBe("function");
  });
});

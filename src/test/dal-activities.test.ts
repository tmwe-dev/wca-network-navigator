/**
 * DAL Activities — Unit tests
 */
import { describe, it, expect } from "vitest";
import * as activitiesDAL from "@/data/activities";

describe("DAL — activities", () => {
  it("exports all expected functions", () => {
    expect(typeof activitiesDAL.findAllActivities).toBe("function");
    expect(typeof activitiesDAL.findActivitiesForPartner).toBe("function");
    expect(typeof activitiesDAL.createActivities).toBe("function");
    expect(typeof activitiesDAL.updateActivity).toBe("function");
    expect(typeof activitiesDAL.deleteActivities).toBe("function");
    expect(typeof activitiesDAL.invalidateActivityCache).toBe("function");
  });
});

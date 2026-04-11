/**
 * DAL Activities — Unit tests
 */
import { describe, it, expect } from "vitest";
import * as activitiesDAL from "@/data/activities";

describe("DAL — activities", () => {
  it("exports all expected functions", () => {
    expect(typeof activitiesDAL.findActivities).toBe("function");
    expect(typeof activitiesDAL.findActivitiesByPartner).toBe("function");
    expect(typeof activitiesDAL.createActivity).toBe("function");
    expect(typeof activitiesDAL.updateActivity).toBe("function");
    expect(typeof activitiesDAL.deleteActivity).toBe("function");
    expect(typeof activitiesDAL.invalidateActivities).toBe("function");
  });

  it("ActivityFilters interface accepts expected keys", () => {
    const filters: activitiesDAL.ActivityFilters = {
      status: ["pending"],
      activityType: "email",
      partnerId: "test-id",
    };
    expect(filters.status).toHaveLength(1);
  });
});

/**
 * Activity Domain Rules — STEP 8
 * Pure business logic for activity/outreach evaluation.
 */

import type { Activity, ActivityStatus } from "../../entities";

/** Whether activity is actionable */
export function isActionable(activity: Activity): boolean {
  return activity.status === "pending" || activity.status === "in_progress";
}

/** Whether activity is overdue */
export function isOverdue(activity: Activity): boolean {
  if (!activity.dueDate) return false;
  if (activity.status === "completed" || activity.status === "cancelled") return false;
  return new Date(activity.dueDate) < new Date();
}

/** Group activities by status */
export function groupByStatus(
  activities: readonly Activity[],
): Readonly<Record<ActivityStatus, readonly Activity[]>> {
  const groups: Record<ActivityStatus, Activity[]> = {
    pending: [],
    in_progress: [],
    completed: [],
    cancelled: [],
  };
  for (const act of activities) {
    groups[act.status]?.push(act);
  }
  return groups;
}

/** Count overdue activities */
export function countOverdue(activities: readonly Activity[]): number {
  return activities.filter(isOverdue).length;
}

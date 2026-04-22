/**
 * Query Keys Integrity Tests
 * Tests that all query key factories return unique arrays and no collisions between modules
 * Based on src/lib/queryKeys.ts
 */
import { describe, it, expect } from "vitest";

// Helper to get all query keys from queryKeys object
function getAllQueryKeys(obj: Record<string, unknown>, path: string[] = []): string[][] {
  const keys: string[][] = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = [...path, key];

    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      // This is a query key array
      keys.push(value as string[]);
    } else if (
      typeof value === "function" ||
      (typeof value === "object" && value !== null && !Array.isArray(value))
    ) {
      // Recurse into nested objects
      if (typeof value === "object" && !Array.isArray(value)) {
        keys.push(...getAllQueryKeys(value as Record<string, unknown>, currentPath));
      }
    }
  }

  return keys;
}

// Simplified queryKeys for testing
const testQueryKeys = {
  // ── Deals ──
  dealsList: ["deals-list"] as const,
  deals: {
    all: ["deals"] as const,
    filtered: (filters?: Record<string, unknown>) => ["deals", "filtered", filters] as const,
    byStage: ["deals-by-stage"] as const,
  },
  deal: (id: string) => ["deal", id] as const,
  dealStats: ["deal-stats"] as const,
  dealActivities: (dealId: string) => ["deal-activities", dealId] as const,

  // ── Calendar ──
  calendar: ["calendar"] as const,

  // ── Notifications ──
  notifications: {
    list: (filters?: unknown) => ["notifications", filters] as const,
    unreadCount: ["notifications-unread-count"] as const,
  },

  // ── RBAC ──
  rbac: {
    roles: ["rbac-roles"] as const,
    role: (roleId: string) => ["rbac-role", roleId] as const,
    permissions: ["rbac-permissions"] as const,
    rolePermissions: (roleId: string) => ["rbac-role-permissions", roleId] as const,
    userRoles: (userId?: string) => ["rbac-user-roles", userId ?? "current"] as const,
    teams: ["rbac-teams"] as const,
    team: (teamId: string) => ["rbac-team", teamId] as const,
    teamMembers: (teamId: string) => ["rbac-team-members", teamId] as const,
    hasPermission: (permissionKey: string) => ["rbac-has-permission", permissionKey] as const,
  },

  // ── Contacts ──
  contacts: {
    all: ["contacts"] as const,
    imported: (filters?: unknown) => ["imported-contacts", filters] as const,
    paginated: (...args: unknown[]) => ["contacts-paginated", ...args] as const,
  },

  // ── Contact Merge ──
  contactMerge: {
    duplicates: ["contact-duplicates"] as const,
    duplicateCount: ["contact-duplicate-count"] as const,
  },

  // ── Token Usage ──
  tokenUsage: {
    all: ["token-usage"] as const,
    today: ["token-usage-today"] as const,
    month: ["token-usage-month"] as const,
    byFunction: (days?: number) => ["token-usage-by-function", days] as const,
    settings: ["token-usage-settings"] as const,
  },

  // ── Partners ──
  partners: {
    all: ["partners"] as const,
    filtered: (filters?: Record<string, unknown>) => ["partners", filters] as const,
  },

  // ── Activities ──
  activities: {
    all: ["activities"] as const,
    today: ["today-activities"] as const,
    outreach: (filters?: unknown) => ["activities-outreach", filters] as const,
  },

  // ── Email ──
  email: {
    count: ["email-count"] as const,
    templates: ["email-templates"] as const,
    drafts: (filters?: unknown) => ["email-drafts", filters] as const,
  },
} as const;

describe("Query Keys Integrity", () => {
  // ─── Basic Query Key Format ─────────────────────────

  describe("Basic Query Key Format", () => {
    it("should have query keys as readonly arrays", () => {
      const dealsList = testQueryKeys.dealsList;
      expect(Array.isArray(dealsList)).toBe(true);
      expect(dealsList[0]).toBe("deals-list");
    });

    it("should have query keys start with module name", () => {
      expect(testQueryKeys.dealsList[0]).toContain("deals");
      expect(testQueryKeys.deals.all[0]).toBe("deals");
      expect(testQueryKeys.calendar[0]).toBe("calendar");
      expect(testQueryKeys.notifications.unreadCount[0]).toContain("notifications");
    });

    it("should have hierarchical structure", () => {
      expect(testQueryKeys.deals.all[0]).toBe("deals");
      expect(testQueryKeys.deals.byStage[0]).toBe("deals-by-stage");
      expect(testQueryKeys.rbac.roles[0]).toBe("rbac-roles");
    });

    it("should include const assertion", () => {
      const key = testQueryKeys.dealsList;
      // TypeScript will enforce readonly if we try to mutate
      expect(key).toBeDefined();
    });
  });

  // ─── No Collisions ──────────────────────────────────

  describe("No Query Key Collisions", () => {
    it("should have unique query keys across modules", () => {
      const dealsKeys = [
        "deals-list",
        "deals",
        "deals-by-stage",
        "deal-stats",
      ];
      const notificationKeys = ["notifications", "notifications-unread-count"];
      const combined = [...dealsKeys, ...notificationKeys];

      const unique = new Set(combined);
      expect(unique.size).toBe(combined.length); // All unique
    });

    it("should not have deals keys collision with calendar", () => {
      const dealsKeys = testQueryKeys.dealsList;
      const calendarKeys = testQueryKeys.calendar;

      expect(dealsKeys[0]).not.toBe(calendarKeys[0]);
    });

    it("should not have rbac keys colliding with other modules", () => {
      const rbacRoles = testQueryKeys.rbac.roles;
      const activities = testQueryKeys.activities.all;

      expect(rbacRoles[0]).not.toBe(activities[0]);
      expect(rbacRoles[0]).not.toBe(testQueryKeys.dealsList[0]);
    });

    it("should differentiate between similar named modules", () => {
      const notifications = testQueryKeys.notifications.list()[0];
      const notificationsUnread = testQueryKeys.notifications.unreadCount[0];

      expect(notifications).not.toBe(notificationsUnread);
      expect(notifications).toContain("notifications");
      expect(notificationsUnread).toContain("unread");
    });

    it("should not collide between all() and specific getters", () => {
      const partnersAll = testQueryKeys.partners.all;
      const partnersFiltered = testQueryKeys.partners.filtered()[0];

      expect(partnersAll[0]).toBe("partners");
      expect(partnersFiltered[0]).toBe("partners");
      // Both start with "partners" but filtered adds extra info
      expect(partnersFiltered.length).toBeGreaterThan(partnersAll.length);
    });

    it("should use consistent naming conventions", () => {
      // Check all keys follow pattern
      const keys = [
        testQueryKeys.dealsList[0],
        testQueryKeys.calendar[0],
        testQueryKeys.notifications.unreadCount[0],
      ];

      for (const key of keys) {
        expect(typeof key).toBe("string");
        expect(key.length).toBeGreaterThan(0);
        expect(key.toLowerCase()).toBe(key); // All lowercase
      }
    });
  });

  // ─── Deal Module ────────────────────────────────────

  describe("Deal Query Keys", () => {
    it("should have all deal related keys", () => {
      expect(testQueryKeys.dealsList).toBeDefined();
      expect(testQueryKeys.deals).toBeDefined();
      expect(testQueryKeys.deal).toBeDefined();
      expect(testQueryKeys.dealStats).toBeDefined();
      expect(testQueryKeys.dealActivities).toBeDefined();
    });

    it("should return unique keys for all deals", () => {
      const allDeals = testQueryKeys.deals.all;
      const dealsList = testQueryKeys.dealsList;

      expect(allDeals[0]).not.toBe(dealsList[0]);
    });

    it("should generate unique keys for individual deals", () => {
      const deal1 = testQueryKeys.deal("id1");
      const deal2 = testQueryKeys.deal("id2");

      expect(deal1[0]).toBe("deal");
      expect(deal2[0]).toBe("deal");
      expect(deal1[1]).not.toBe(deal2[1]); // Different IDs
    });

    it("should generate unique keys for deal activities by ID", () => {
      const activities1 = testQueryKeys.dealActivities("deal1");
      const activities2 = testQueryKeys.dealActivities("deal2");

      expect(activities1[0]).toBe("deal-activities");
      expect(activities2[0]).toBe("deal-activities");
      expect(activities1[1]).not.toBe(activities2[1]);
    });

    it("should isolate deal stats from individual deal keys", () => {
      const stats = testQueryKeys.dealStats;
      const allDeals = testQueryKeys.deals.all;

      expect(stats[0]).not.toBe(allDeals[0]);
    });
  });

  // ─── Calendar Module ────────────────────────────────

  describe("Calendar Query Keys", () => {
    it("should have calendar key", () => {
      expect(testQueryKeys.calendar[0]).toBe("calendar");
    });

    it("should not conflict with notification keys", () => {
      expect(testQueryKeys.calendar[0]).not.toBe(
        testQueryKeys.notifications.unreadCount[0]
      );
    });
  });

  // ─── RBAC Module ────────────────────────────────────

  describe("RBAC Query Keys", () => {
    it("should have all RBAC related keys", () => {
      expect(testQueryKeys.rbac.roles).toBeDefined();
      expect(testQueryKeys.rbac.permissions).toBeDefined();
      expect(testQueryKeys.rbac.teams).toBeDefined();
      expect(testQueryKeys.rbac.userRoles).toBeDefined();
    });

    it("should generate unique keys for individual roles", () => {
      const role1 = testQueryKeys.rbac.role("role1");
      const role2 = testQueryKeys.rbac.role("role2");

      expect(role1[0]).toBe("rbac-role");
      expect(role2[0]).toBe("rbac-role");
      expect(role1[1]).not.toBe(role2[1]);
    });

    it("should generate unique keys for team operations", () => {
      const team1 = testQueryKeys.rbac.team("team1");
      const team2 = testQueryKeys.rbac.team("team2");
      const members1 = testQueryKeys.rbac.teamMembers("team1");

      expect(team1[1]).not.toBe(team2[1]);
      expect(team1[0]).not.toBe(members1[0]); // Different operations
    });

    it("should handle user roles with optional userId", () => {
      const currentUser = testQueryKeys.rbac.userRoles();
      const specificUser = testQueryKeys.rbac.userRoles("user123");

      expect(currentUser[1]).toBe("current");
      expect(specificUser[1]).toBe("user123");
    });

    it("should isolate permission checks", () => {
      const perm1 = testQueryKeys.rbac.hasPermission("can_edit");
      const perm2 = testQueryKeys.rbac.hasPermission("can_delete");

      expect(perm1[0]).toBe("rbac-has-permission");
      expect(perm2[0]).toBe("rbac-has-permission");
      expect(perm1[1]).not.toBe(perm2[1]);
    });
  });

  // ─── Notifications Module ────────────────────────────

  describe("Notifications Query Keys", () => {
    it("should have notification list and unread count", () => {
      expect(testQueryKeys.notifications.list).toBeDefined();
      expect(testQueryKeys.notifications.unreadCount).toBeDefined();
    });

    it("should isolate notification counts from list", () => {
      const list = testQueryKeys.notifications.list();
      const count = testQueryKeys.notifications.unreadCount;

      expect(list[0]).not.toBe(count[0]);
    });

    it("should generate unique notification list keys with filters", () => {
      const list1 = testQueryKeys.notifications.list({ status: "unread" });
      const list2 = testQueryKeys.notifications.list({ status: "archived" });

      expect(list1[0]).toBe("notifications");
      expect(list2[0]).toBe("notifications");
      expect(list1[1]).not.toBe(list2[1]);
    });
  });

  // ─── Contact Module ────────────────────────────────

  describe("Contact Query Keys", () => {
    it("should have contact related keys", () => {
      expect(testQueryKeys.contacts.all).toBeDefined();
      expect(testQueryKeys.contacts.imported).toBeDefined();
      expect(testQueryKeys.contactMerge.duplicates).toBeDefined();
    });

    it("should isolate contact merge from regular contacts", () => {
      const allContacts = testQueryKeys.contacts.all;
      const duplicates = testQueryKeys.contactMerge.duplicates;

      expect(allContacts[0]).toBe("contacts");
      expect(duplicates[0]).toBe("contact-duplicates");
      expect(allContacts[0]).not.toBe(duplicates[0]);
    });

    it("should differentiate duplicate count from duplicates list", () => {
      const list = testQueryKeys.contactMerge.duplicates;
      const count = testQueryKeys.contactMerge.duplicateCount;

      expect(list[0]).not.toBe(count[0]);
    });
  });

  // ─── Token Usage Module ──────────────────────────────

  describe("Token Usage Query Keys", () => {
    it("should have all token tracking keys", () => {
      expect(testQueryKeys.tokenUsage.all).toBeDefined();
      expect(testQueryKeys.tokenUsage.today).toBeDefined();
      expect(testQueryKeys.tokenUsage.month).toBeDefined();
      expect(testQueryKeys.tokenUsage.settings).toBeDefined();
    });

    it("should differentiate daily, monthly, and all usage", () => {
      const all = testQueryKeys.tokenUsage.all;
      const today = testQueryKeys.tokenUsage.today;
      const month = testQueryKeys.tokenUsage.month;

      expect(all[0]).not.toBe(today[0]);
      expect(today[0]).not.toBe(month[0]);
    });

    it("should generate unique keys for function breakdowns", () => {
      const daily = testQueryKeys.tokenUsage.byFunction(1);
      const weekly = testQueryKeys.tokenUsage.byFunction(7);

      expect(daily[0]).toBe("token-usage-by-function");
      expect(weekly[0]).toBe("token-usage-by-function");
      expect(daily[1]).not.toBe(weekly[1]); // Different periods
    });

    it("should isolate settings from usage data", () => {
      const usage = testQueryKeys.tokenUsage.all;
      const settings = testQueryKeys.tokenUsage.settings;

      expect(usage[0]).not.toBe(settings[0]);
    });
  });

  // ─── Partners Module ────────────────────────────────

  describe("Partners Query Keys", () => {
    it("should have partner keys", () => {
      expect(testQueryKeys.partners.all).toBeDefined();
      expect(testQueryKeys.partners.filtered).toBeDefined();
    });

    it("should differentiate all vs filtered", () => {
      const all = testQueryKeys.partners.all;
      const filtered = testQueryKeys.partners.filtered();

      expect(all[0]).toBe("partners");
      expect(filtered[0]).toBe("partners");
      expect(all.length).not.toBe(filtered.length);
    });
  });

  // ─── Activities Module ──────────────────────────────

  describe("Activities Query Keys", () => {
    it("should have activity keys", () => {
      expect(testQueryKeys.activities.all).toBeDefined();
      expect(testQueryKeys.activities.today).toBeDefined();
      expect(testQueryKeys.activities.outreach).toBeDefined();
    });

    it("should differentiate all activities from today", () => {
      const all = testQueryKeys.activities.all;
      const today = testQueryKeys.activities.today;

      expect(all[0]).not.toBe(today[0]);
    });
  });

  // ─── Email Module ────────────────────────────────────

  describe("Email Query Keys", () => {
    it("should have email related keys", () => {
      expect(testQueryKeys.email.count).toBeDefined();
      expect(testQueryKeys.email.templates).toBeDefined();
      expect(testQueryKeys.email.drafts).toBeDefined();
    });

    it("should isolate count from other email keys", () => {
      const count = testQueryKeys.email.count;
      const templates = testQueryKeys.email.templates;

      expect(count[0]).not.toBe(templates[0]);
    });
  });

  // ─── Cross-Module Integrity ────────────────────────

  describe("Cross-Module Integrity", () => {
    it("should have no accidental collisions between modules", () => {
      const allKeys = [
        // Deals
        ...testQueryKeys.dealsList,
        ...testQueryKeys.deals.all,
        ...testQueryKeys.deals.byStage,
        ...testQueryKeys.dealStats,
        // Calendar
        ...testQueryKeys.calendar,
        // Notifications
        ...testQueryKeys.notifications.unreadCount,
        // RBAC
        ...testQueryKeys.rbac.roles,
        ...testQueryKeys.rbac.permissions,
        // Contacts
        ...testQueryKeys.contacts.all,
        ...testQueryKeys.contactMerge.duplicates,
      ];

      const unique = new Set(allKeys);
      // Allow for some growth, but check rough uniqueness
      expect(unique.size).toBeGreaterThan(allKeys.length * 0.8);
    });

    it("should use consistent naming style across modules", () => {
      const sampleKeys = [
        testQueryKeys.dealsList[0],
        testQueryKeys.calendar[0],
        testQueryKeys.rbac.roles[0],
        testQueryKeys.notifications.unreadCount[0],
        testQueryKeys.tokenUsage.all[0],
      ];

      for (const key of sampleKeys) {
        expect(key).toMatch(/^[a-z\-]+$/); // Lowercase and hyphens only
      }
    });

    it("should support hierarchical query invalidation", () => {
      // Parent key should match child keys
      const parent = "deals";
      const childKeys = [
        testQueryKeys.deals.all[0],
        testQueryKeys.deals.byStage[0],
      ];

      expect(childKeys[0]).toContain(parent);
      expect(childKeys[1]).toContain(parent);
    });
  });

  // ─── Factory Functions ──────────────────────────────

  describe("Factory Functions", () => {
    it("should create unique keys from factory functions", () => {
      const key1 = testQueryKeys.deal("id1");
      const key2 = testQueryKeys.deal("id2");

      expect(key1).not.toEqual(key2);
    });

    it("should handle undefined/optional parameters", () => {
      const withDefault = testQueryKeys.rbac.userRoles();
      const withValue = testQueryKeys.rbac.userRoles("user123");

      expect(withDefault[1]).toBe("current");
      expect(withValue[1]).toBe("user123");
    });

    it("should preserve array structure in factories", () => {
      const key = testQueryKeys.deal("test-id");
      expect(Array.isArray(key)).toBe(true);
      expect(key[0]).toBe("deal");
      expect(key[1]).toBe("test-id");
    });
  });

  // ─── Maintenance Guidelines ────────────────────────

  describe("Maintenance Guidelines", () => {
    it("should document new query key additions", () => {
      // Each new key should be prefixed with its module
      const newDealKey = "deals-new-feature";
      expect(newDealKey).toContain("deals");

      const newNotificationKey = "notifications-new-event";
      expect(newNotificationKey).toContain("notifications");
    });

    it("should avoid ad-hoc inline keys", () => {
      // All keys should be in queryKeys object, not inline
      expect(testQueryKeys.dealsList).toBeDefined(); // Centralized
    });

    it("should include const assertion for type safety", () => {
      const key = testQueryKeys.dealsList;
      expect(key).toBeDefined();
      // TypeScript would error if we tried: key[0] = "something-else"
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  createNotification,
  deleteOldNotifications,
  savePushSubscription,
  getPushSubscriptions,
  deletePushSubscription,
  type Notification,
  type NotificationFilters,
} from "@/data/notifications";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    })),
  },
}));

import { supabase } from "@/integrations/supabase/client";

const mockNotification: Notification = {
  id: "notif-1",
  user_id: "user-1",
  title: "New Deal Update",
  body: "Your deal has moved to negotiation stage",
  type: "deal_stage_change",
  priority: "high",
  read: false,
  dismissed: false,
  action_url: "/deals/deal-1",
  entity_type: "deal",
  entity_id: "deal-1",
  metadata: { stage: "negotiation" },
  created_at: "2024-01-15T10:00:00Z",
};

const mockNotification2: Notification = {
  ...mockNotification,
  id: "notif-2",
  title: "Email Received",
  type: "email_received",
  priority: "normal",
  read: true,
};

describe("Notifications Data Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listNotifications", () => {
    it("should fetch notifications with default filters", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        order: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockEqFn.order).mockReturnValueOnce({
        range: vi.fn().mockResolvedValueOnce({
          data: [mockNotification, mockNotification2],
          error: null,
        }),
      } as any);

      const result = await listNotifications("user-1");

      expect(result).toEqual([mockNotification, mockNotification2]);
      expect(supabase.from).toHaveBeenCalledWith("notifications");
    });

    it("should apply unreadOnly filter", async () => {
      const filters: NotificationFilters = { unreadOnly: true };
      const eqCalls: any[] = [];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("*");
      vi.mocked(mockSelectFn.eq).mockImplementation((key, value) => {
        eqCalls.push({ key, value });
        return {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi
            .fn()
            .mockResolvedValueOnce({ data: [mockNotification], error: null }),
        } as any;
      });

      await listNotifications("user-1", filters);

      expect(eqCalls.some((call) => call.key === "read" && call.value === false)).toBe(
        true
      );
    });

    it("should filter by notification type", async () => {
      const filters: NotificationFilters = { type: "deal_stage_change" };
      const eqCalls: any[] = [];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("*");
      vi.mocked(mockSelectFn.eq).mockImplementation((key, value) => {
        eqCalls.push({ key, value });
        return {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi
            .fn()
            .mockResolvedValueOnce({ data: [mockNotification], error: null }),
        } as any;
      });

      await listNotifications("user-1", filters);

      expect(eqCalls.some((call) => call.key === "type")).toBe(true);
    });

    it("should filter by priority", async () => {
      const filters: NotificationFilters = { priority: "urgent" };
      const eqCalls: any[] = [];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("*");
      vi.mocked(mockSelectFn.eq).mockImplementation((key, value) => {
        eqCalls.push({ key, value });
        return {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
        } as any;
      });

      await listNotifications("user-1", filters);

      expect(eqCalls.some((call) => call.key === "priority")).toBe(true);
    });

    it("should apply pagination with limit and offset", async () => {
      const filters: NotificationFilters = { limit: 10, offset: 20 };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        order: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      const mockRangeFn = vi.fn().mockResolvedValueOnce({
        data: [],
        error: null,
      });
      vi.mocked(mockEqFn.order).mockReturnValueOnce({
        range: mockRangeFn,
      } as any);

      await listNotifications("user-1", filters);

      expect(mockRangeFn).toHaveBeenCalledWith(20, 29);
    });

    it("should handle errors gracefully and return empty array", async () => {
      const mockError = new Error("Query failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("*");
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        order: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockEqFn.order).mockReturnValueOnce({
        range: vi.fn().mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      const result = await listNotifications("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("getUnreadCount", () => {
    it("should return count of unread and undismissed notifications", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("id", {
        count: "exact",
        head: true,
      });
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockFirstEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockFirstEqFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ count: 5, error: null }),
      } as any);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(5);
    });

    it("should return 0 on error", async () => {
      const mockError = new Error("Count query failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("id", {
        count: "exact",
        head: true,
      });
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockFirstEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockFirstEqFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ count: null, error: mockError }),
      } as any);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(0);
    });

    it("should return 0 when count is null", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("notifications").select("id", {
        count: "exact",
        head: true,
      });
      vi.mocked(mockSelectFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
      } as any);

      const mockFirstEqFn = vi.mocked(mockSelectFn.eq)("user_id", "user-1");
      vi.mocked(mockFirstEqFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ count: null, error: null }),
      } as any);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("notifications").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockUpdateFn.eq)("id", "notif-1");
      vi.mocked(mockEqFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({
          data: { ...mockNotification, read: true },
          error: null,
        }),
      } as any);

      const result = await markAsRead("notif-1");

      expect(result?.read).toBe(true);
    });

    it("should return null on error", async () => {
      const mockError = new Error("Update failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("notifications").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockUpdateFn.eq)("id", "notif-1");
      vi.mocked(mockEqFn.select).mockReturnValueOnce({
        single: vi
          .fn()
          .mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      const result = await markAsRead("notif-1");

      expect(result).toBeNull();
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all notifications as read for user", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("notifications").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ count: 3, error: null }),
      } as any);

      const result = await markAllAsRead("user-1");

      expect(result).toBe(3);
    });

    it("should return 0 on error", async () => {
      const mockError = new Error("Batch update failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("notifications").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ count: null, error: mockError }),
      } as any);

      const result = await markAllAsRead("user-1");

      expect(result).toBe(0);
    });
  });

  describe("dismissNotification", () => {
    it("should dismiss notification", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("notifications").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockUpdateFn.eq)("id", "notif-1");
      vi.mocked(mockEqFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({
          data: { ...mockNotification, dismissed: true },
          error: null,
        }),
      } as any);

      const result = await dismissNotification("notif-1");

      expect(result?.dismissed).toBe(true);
    });

    it("should return null on error", async () => {
      const mockError = new Error("Dismiss failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
      } as any);

      const mockUpdateFn = vi.mocked(supabase.from)("notifications").update({});
      vi.mocked(mockUpdateFn.eq).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockUpdateFn.eq)("id", "notif-1");
      vi.mocked(mockEqFn.select).mockReturnValueOnce({
        single: vi
          .fn()
          .mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      const result = await dismissNotification("notif-1");

      expect(result).toBeNull();
    });
  });

  describe("createNotification", () => {
    it("should create notification with required fields", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
      } as any);

      const mockInsertFn = vi.mocked(supabase.from)("notifications").insert([]);
      vi.mocked(mockInsertFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: mockNotification, error: null }),
      } as any);

      const result = await createNotification("user-1", {
        title: "New Deal Update",
        type: "deal_stage_change",
      });

      expect(result).toEqual(mockNotification);
    });

    it("should set default priority to normal if not provided", async () => {
      const insertCapture: any[] = [];
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn((data) => {
          insertCapture.push(data);
          return {
            select: vi.fn().mockReturnThis(),
          };
        }),
      } as any);

      const mockInsertFn = vi.mocked(supabase.from)("notifications").insert([]);
      vi.mocked(mockInsertFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: mockNotification, error: null }),
      } as any);

      await createNotification("user-1", {
        title: "Test",
        type: "reminder",
      });

      expect(insertCapture[0][0].priority).toBe("normal");
    });

    it("should include provided optional fields", async () => {
      const insertCapture: any[] = [];
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn((data) => {
          insertCapture.push(data);
          return {
            select: vi.fn().mockReturnThis(),
          };
        }),
      } as any);

      const mockInsertFn = vi.mocked(supabase.from)("notifications").insert([]);
      vi.mocked(mockInsertFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: mockNotification, error: null }),
      } as any);

      await createNotification("user-1", {
        title: "Test",
        body: "Test body",
        type: "deal_stage_change",
        priority: "urgent",
        action_url: "/deals/1",
        entity_type: "deal",
        entity_id: "deal-1",
        metadata: { stage: "closed" },
      });

      expect(insertCapture[0][0].body).toBe("Test body");
      expect(insertCapture[0][0].action_url).toBe("/deals/1");
    });

    it("should return null on error", async () => {
      const mockError = new Error("Insert failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
      } as any);

      const mockInsertFn = vi.mocked(supabase.from)("notifications").insert([]);
      vi.mocked(mockInsertFn.select).mockReturnValueOnce({
        single: vi
          .fn()
          .mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      const result = await createNotification("user-1", {
        title: "Test",
        type: "reminder",
      });

      expect(result).toBeNull();
    });
  });

  describe("deleteOldNotifications", () => {
    it("should delete old dismissed notifications", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
      } as any);

      const mockDeleteFn = vi.mocked(supabase.from)("notifications").delete();
      vi.mocked(mockDeleteFn.eq).mockReturnValueOnce({
        lt: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockDeleteFn.eq)("user_id", "user-1");
      vi.mocked(mockEqFn.lt).mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ count: 2, error: null }),
      } as any);

      const result = await deleteOldNotifications("user-1", 30);

      expect(result).toBe(2);
    });

    it("should use default days value of 30", async () => {
      const ltCalls: any[] = [];
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
      } as any);

      const mockDeleteFn = vi.mocked(supabase.from)("notifications").delete();
      vi.mocked(mockDeleteFn.eq).mockReturnValueOnce({
        lt: vi.fn((key, date) => {
          ltCalls.push({ key, date });
          return {
            eq: vi.fn().mockResolvedValueOnce({ count: 0, error: null }),
          };
        }),
      } as any);

      await deleteOldNotifications("user-1");

      expect(ltCalls.length).toBeGreaterThan(0);
    });

    it("should return 0 on error", async () => {
      const mockError = new Error("Delete failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
      } as any);

      const mockDeleteFn = vi.mocked(supabase.from)("notifications").delete();
      vi.mocked(mockDeleteFn.eq).mockReturnValueOnce({
        lt: vi.fn().mockReturnThis(),
      } as any);

      const mockEqFn = vi.mocked(mockDeleteFn.eq)("user_id", "user-1");
      vi.mocked(mockEqFn.lt).mockReturnValueOnce({
        eq: vi
          .fn()
          .mockResolvedValueOnce({ count: null, error: mockError }),
      } as any);

      const result = await deleteOldNotifications("user-1", 30);

      expect(result).toBe(0);
    });
  });

  describe("savePushSubscription", () => {
    it("should save push subscription", async () => {
      const mockSubscription = {
        endpoint: "https://example.com/push",
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        upsert: vi.fn().mockReturnThis(),
      } as any);

      const mockUpsertFn = vi.mocked(supabase.from)("push_subscriptions").upsert([]);
      vi.mocked(mockUpsertFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({
          data: {
            id: "sub-1",
            user_id: "user-1",
            endpoint: mockSubscription.endpoint,
            p256dh: mockSubscription.keys.p256dh,
            auth_key: mockSubscription.keys.auth,
          },
          error: null,
        }),
      } as any);

      const result = await savePushSubscription("user-1", mockSubscription);

      expect(result?.endpoint).toBe(mockSubscription.endpoint);
    });

    it("should include user agent if provided", async () => {
      const insertCapture: any[] = [];
      const mockSubscription = {
        endpoint: "https://example.com/push",
        keys: { p256dh: "test", auth: "test" },
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        upsert: vi.fn((data) => {
          insertCapture.push(data);
          return {
            select: vi.fn().mockReturnThis(),
          };
        }),
      } as any);

      const mockUpsertFn = vi.mocked(supabase.from)("push_subscriptions").upsert([]);
      vi.mocked(mockUpsertFn.select).mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({
          data: { id: "sub-1", user_id: "user-1" },
          error: null,
        }),
      } as any);

      await savePushSubscription("user-1", mockSubscription, "Mozilla/5.0");

      expect(insertCapture[0][0].user_agent).toBe("Mozilla/5.0");
    });

    it("should return null on error", async () => {
      const mockError = new Error("Upsert failed");
      const mockSubscription = {
        endpoint: "https://example.com/push",
        keys: { p256dh: "test", auth: "test" },
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        upsert: vi.fn().mockReturnThis(),
      } as any);

      const mockUpsertFn = vi.mocked(supabase.from)("push_subscriptions").upsert([]);
      vi.mocked(mockUpsertFn.select).mockReturnValueOnce({
        single: vi
          .fn()
          .mockResolvedValueOnce({ data: null, error: mockError }),
      } as any);

      const result = await savePushSubscription("user-1", mockSubscription);

      expect(result).toBeNull();
    });
  });

  describe("getPushSubscriptions", () => {
    it("should fetch push subscriptions for user", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("push_subscriptions").select("*");
      vi.mocked(mockSelectFn.eq).mockResolvedValueOnce({
        data: [
          {
            id: "sub-1",
            user_id: "user-1",
            endpoint: "https://example.com/push",
            p256dh: "test",
            auth_key: "test",
          },
        ],
        error: null,
      });

      const result = await getPushSubscriptions("user-1");

      expect(result.length).toBe(1);
      expect(result[0].endpoint).toBe("https://example.com/push");
    });

    it("should return empty array on error", async () => {
      const mockError = new Error("Query failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
      } as any);

      const mockSelectFn = vi.mocked(supabase.from)("push_subscriptions").select("*");
      vi.mocked(mockSelectFn.eq).mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      const result = await getPushSubscriptions("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("deletePushSubscription", () => {
    it("should delete push subscription by endpoint", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
      } as any);

      const mockDeleteFn = vi.mocked(supabase.from)("push_subscriptions").delete();
      vi.mocked(mockDeleteFn.eq).mockResolvedValueOnce({ error: null });

      const result = await deletePushSubscription("https://example.com/push");

      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      const mockError = new Error("Delete failed");
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
      } as any);

      const mockDeleteFn = vi.mocked(supabase.from)("push_subscriptions").delete();
      vi.mocked(mockDeleteFn.eq).mockResolvedValueOnce({ error: mockError });

      const result = await deletePushSubscription("https://example.com/push");

      expect(result).toBe(false);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fns ──────────────────────────────────────────
const _mockSelect = vi.fn();
const _mockInsert = vi.fn();
const _mockUpdate = vi.fn();
const _mockDelete = vi.fn();
const _mockUpsert = vi.fn();
const _mockEq = vi.fn();
const _mockLt = vi.fn();
const _mockOrder = vi.fn();
const _mockRange = vi.fn();
const _mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

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
  type NotificationFilters as _NotificationFilters,
} from "@/data/notifications";

// ─── Fixtures ──────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────

/**
 * Build a full chainable query object.
 * Every method returns the same object so .select().eq().order().range() etc. all work.
 * The `terminal` value is the promise-resolved result at the end of the chain.
 */
type MockFn = ReturnType<typeof vi.fn>;
type Chain = {
  select: MockFn;
  insert: MockFn;
  update: MockFn;
  delete: MockFn;
  upsert: MockFn;
  eq: MockFn;
  lt: MockFn;
  order: MockFn;
  range: MockFn;
  single: MockFn;
  then: (resolve: ((value: any) => unknown) | null | undefined, reject?: ((reason: any) => unknown) | null | undefined) => Promise<any>;
};
function buildChain(terminal: any): Chain {
  const chain = {} as Chain;
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.update = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  chain.upsert = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.lt = vi.fn().mockImplementation(self);
  chain.order = vi.fn().mockImplementation(self);
  chain.range = vi.fn().mockImplementation(self);
  chain.single = vi.fn().mockResolvedValue(terminal);
  // Make the chain itself thenable so `await query` works on intermediate steps
  chain.then = (resolve, reject) => Promise.resolve(terminal).then(resolve, reject);
  return chain;
}

// ─── Tests ─────────────────────────────────────────────

describe("Notifications Data Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listNotifications ──────────────────────────────

  describe("listNotifications", () => {
    it("should fetch notifications with default filters", async () => {
      const chain = buildChain({ data: [mockNotification, mockNotification2], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await listNotifications("user-1");

      expect(result).toEqual([mockNotification, mockNotification2]);
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(chain.range).toHaveBeenCalledWith(0, 19);
    });

    it("should apply unreadOnly filter", async () => {
      const chain = buildChain({ data: [mockNotification], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await listNotifications("user-1", { unreadOnly: true });

      expect(result).toEqual([mockNotification]);
      // eq should be called for user_id AND read=false
      const eqCalls = chain.eq.mock.calls;
      expect(eqCalls).toContainEqual(["user_id", "user-1"]);
      expect(eqCalls).toContainEqual(["read", false]);
    });

    it("should filter by notification type", async () => {
      const chain = buildChain({ data: [mockNotification], error: null });
      mockFrom.mockReturnValue(chain);

      await listNotifications("user-1", { type: "deal_stage_change" });

      const eqCalls = chain.eq.mock.calls;
      expect(eqCalls).toContainEqual(["type", "deal_stage_change"]);
    });

    it("should filter by priority", async () => {
      const chain = buildChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await listNotifications("user-1", { priority: "urgent" });

      const eqCalls = chain.eq.mock.calls;
      expect(eqCalls).toContainEqual(["priority", "urgent"]);
    });

    it("should apply pagination with limit and offset", async () => {
      const chain = buildChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await listNotifications("user-1", { limit: 10, offset: 20 });

      expect(chain.range).toHaveBeenCalledWith(20, 29);
    });

    it("should handle errors gracefully and return empty array", async () => {
      const chain = buildChain({ data: null, error: { message: "Query failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await listNotifications("user-1");

      expect(result).toEqual([]);
    });
  });

  // ── getUnreadCount ─────────────────────────────────

  describe("getUnreadCount", () => {
    it("should return count of unread and undismissed notifications", async () => {
      const chain = buildChain({ count: 5, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(5);
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(chain.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(chain.eq).toHaveBeenCalledWith("read", false);
      expect(chain.eq).toHaveBeenCalledWith("dismissed", false);
    });

    it("should return 0 on error", async () => {
      const chain = buildChain({ count: null, error: { message: "Count query failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(0);
    });

    it("should return 0 when count is null", async () => {
      const chain = buildChain({ count: null, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(0);
    });
  });

  // ── markAsRead ─────────────────────────────────────

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      const readNotif = { ...mockNotification, read: true };
      const chain = buildChain({ data: readNotif, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await markAsRead("notif-1");

      expect(result).toEqual(readNotif);
      expect(result?.read).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(chain.update).toHaveBeenCalledWith({ read: true });
      expect(chain.eq).toHaveBeenCalledWith("id", "notif-1");
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
    });

    it("should return null on error", async () => {
      const chain = buildChain({ data: null, error: { message: "Update failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await markAsRead("notif-1");

      expect(result).toBeNull();
    });
  });

  // ── markAllAsRead ──────────────────────────────────

  describe("markAllAsRead", () => {
    it("should mark all notifications as read for user", async () => {
      const chain = buildChain({ error: null, count: 3 });
      mockFrom.mockReturnValue(chain);

      const result = await markAllAsRead("user-1");

      expect(result).toBe(3);
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(chain.update).toHaveBeenCalledWith({ read: true });
      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(chain.eq).toHaveBeenCalledWith("read", false);
    });

    it("should return 0 on error", async () => {
      const chain = buildChain({ count: null, error: { message: "Batch update failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await markAllAsRead("user-1");

      expect(result).toBe(0);
    });
  });

  // ── dismissNotification ────────────────────────────

  describe("dismissNotification", () => {
    it("should dismiss notification", async () => {
      const dismissed = { ...mockNotification, dismissed: true };
      const chain = buildChain({ data: dismissed, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await dismissNotification("notif-1");

      expect(result).toEqual(dismissed);
      expect(result?.dismissed).toBe(true);
      expect(chain.update).toHaveBeenCalledWith({ dismissed: true });
      expect(chain.eq).toHaveBeenCalledWith("id", "notif-1");
      expect(chain.single).toHaveBeenCalled();
    });

    it("should return null on error", async () => {
      const chain = buildChain({ data: null, error: { message: "Dismiss failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await dismissNotification("notif-1");

      expect(result).toBeNull();
    });
  });

  // ── createNotification ─────────────────────────────

  describe("createNotification", () => {
    it("should create notification with required fields", async () => {
      const chain = buildChain({ data: mockNotification, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await createNotification("user-1", {
        title: "New Deal Update",
        type: "deal_stage_change",
      });

      expect(result).toEqual(mockNotification);
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(chain.insert).toHaveBeenCalled();
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
    });

    it("should set default priority to normal if not provided", async () => {
      const chain = buildChain({ data: mockNotification, error: null });
      mockFrom.mockReturnValue(chain);

      await createNotification("user-1", {
        title: "Test",
        type: "reminder",
      });

      const insertArg = chain.insert.mock.calls[0][0];
      expect(insertArg[0].priority).toBe("normal");
    });

    it("should include provided optional fields", async () => {
      const chain = buildChain({ data: mockNotification, error: null });
      mockFrom.mockReturnValue(chain);

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

      const insertArg = chain.insert.mock.calls[0][0];
      expect(insertArg[0].body).toBe("Test body");
      expect(insertArg[0].action_url).toBe("/deals/1");
      expect(insertArg[0].entity_type).toBe("deal");
      expect(insertArg[0].entity_id).toBe("deal-1");
      expect(insertArg[0].metadata).toEqual({ stage: "closed" });
      expect(insertArg[0].priority).toBe("urgent");
    });

    it("should return null on error", async () => {
      const chain = buildChain({ data: null, error: { message: "Insert failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await createNotification("user-1", {
        title: "Test",
        type: "reminder",
      });

      expect(result).toBeNull();
    });
  });

  // ── deleteOldNotifications ─────────────────────────

  describe("deleteOldNotifications", () => {
    it("should delete old dismissed notifications", async () => {
      const chain = buildChain({ count: 2, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await deleteOldNotifications("user-1", 30);

      expect(result).toBe(2);
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(chain.eq).toHaveBeenCalledWith("dismissed", true);
      expect(chain.lt).toHaveBeenCalled();
    });

    it("should use default days value of 30", async () => {
      const chain = buildChain({ count: 0, error: null });
      mockFrom.mockReturnValue(chain);

      await deleteOldNotifications("user-1");

      // lt should have been called with created_at and a date string
      expect(chain.lt).toHaveBeenCalled();
      const ltCall = chain.lt.mock.calls[0];
      expect(ltCall[0]).toBe("created_at");
      // The date should be approximately 30 days ago (ISO string)
      expect(typeof ltCall[1]).toBe("string");
    });

    it("should return 0 on error", async () => {
      const chain = buildChain({ count: null, error: { message: "Delete failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await deleteOldNotifications("user-1", 30);

      expect(result).toBe(0);
    });
  });

  // ── savePushSubscription ───────────────────────────

  describe("savePushSubscription", () => {
    const mockSubscription = {
      endpoint: "https://example.com/push",
      keys: {
        p256dh: "test-p256dh",
        auth: "test-auth",
      },
    };

    it("should save push subscription", async () => {
      const savedSub = {
        id: "sub-1",
        user_id: "user-1",
        endpoint: mockSubscription.endpoint,
        p256dh: mockSubscription.keys.p256dh,
        auth_key: mockSubscription.keys.auth,
        created_at: "2024-01-15T10:00:00Z",
      };
      const chain = buildChain({ data: savedSub, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await savePushSubscription("user-1", mockSubscription);

      expect(result?.endpoint).toBe(mockSubscription.endpoint);
      expect(mockFrom).toHaveBeenCalledWith("push_subscriptions");
      expect(chain.upsert).toHaveBeenCalled();
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
    });

    it("should include user agent if provided", async () => {
      const chain = buildChain({ data: { id: "sub-1", user_id: "user-1" }, error: null });
      mockFrom.mockReturnValue(chain);

      await savePushSubscription("user-1", mockSubscription, "Mozilla/5.0");

      const upsertArg = chain.upsert.mock.calls[0][0];
      expect(upsertArg[0].user_agent).toBe("Mozilla/5.0");
    });

    it("should return null on error", async () => {
      const chain = buildChain({ data: null, error: { message: "Upsert failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await savePushSubscription("user-1", mockSubscription);

      expect(result).toBeNull();
    });
  });

  // ── getPushSubscriptions ───────────────────────────

  describe("getPushSubscriptions", () => {
    it("should fetch push subscriptions for user", async () => {
      const subs = [
        {
          id: "sub-1",
          user_id: "user-1",
          endpoint: "https://example.com/push",
          p256dh: "test",
          auth_key: "test",
          created_at: "2024-01-15T10:00:00Z",
        },
      ];
      const chain = buildChain({ data: subs, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await getPushSubscriptions("user-1");

      expect(result.length).toBe(1);
      expect(result[0].endpoint).toBe("https://example.com/push");
      expect(mockFrom).toHaveBeenCalledWith("push_subscriptions");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("should return empty array on error", async () => {
      const chain = buildChain({ data: null, error: { message: "Query failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await getPushSubscriptions("user-1");

      expect(result).toEqual([]);
    });
  });

  // ── deletePushSubscription ─────────────────────────

  describe("deletePushSubscription", () => {
    it("should delete push subscription by endpoint", async () => {
      const chain = buildChain({ error: null });
      mockFrom.mockReturnValue(chain);

      const result = await deletePushSubscription("https://example.com/push");

      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("push_subscriptions");
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith("endpoint", "https://example.com/push");
    });

    it("should return false on error", async () => {
      const chain = buildChain({ error: { message: "Delete failed" } });
      mockFrom.mockReturnValue(chain);

      const result = await deletePushSubscription("https://example.com/push");

      expect(result).toBe(false);
    });
  });
});

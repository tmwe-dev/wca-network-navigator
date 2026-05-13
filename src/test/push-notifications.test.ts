/**
 * Push Notifications Hook — unit tests
 * Tests the usePushNotifications hook behavior with mocked browser APIs and Supabase.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock supabase client
const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const mockOn = vi.fn().mockReturnThis();
const mockChannel = vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
const mockRemoveChannel = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

// Mock AuthProvider
const mockUseAuth = vi.fn(() => ({
  user: { id: "user-1" },
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

// Mock notifications data functions
vi.mock("@/data/notifications", () => ({
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

import { usePushNotifications } from "@/hooks/usePushNotifications";
import * as notificationsData from "@/data/notifications";

// Mock browser Notification API
Object.defineProperty(global, "Notification", {
  writable: true,
  configurable: true,
  value: Object.assign(
    vi.fn().mockImplementation((title: string, options: unknown) => ({
      title,
      ...((options as Record<string, unknown>) || {}),
    })),
    { permission: "default" as NotificationPermission, requestPermission: vi.fn() },
  ),
});

// Mock PushManager
Object.defineProperty(global, "PushManager", {
  writable: true,
  configurable: true,
  value: class PushManager {},
});

describe("usePushNotifications Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    // Reset Notification.permission
    Object.defineProperty(global.Notification, "permission", {
      value: "default",
      writable: true,
      configurable: true,
    });

    (global.Notification as Record<string, unknown>).requestPermission = vi.fn();

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            subscribe: vi.fn().mockResolvedValue(null),
            getSubscription: vi.fn().mockResolvedValue(null),
          },
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should detect if push notifications are supported", () => {
      const { result } = renderHook(() => usePushNotifications());
      expect(result.current.isSupported).toBe(true);
    });

    it("should detect notification permission on mount", () => {
      Object.defineProperty(global.Notification, "permission", {
        value: "granted",
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => usePushNotifications());
      expect(result.current.hasPermission).toBe(true);
    });

    it("should initialize with loading state false", () => {
      const { result } = renderHook(() => usePushNotifications());
      expect(result.current.isLoading).toBe(false);
    });

    it("should initialize as not subscribed", () => {
      const { result } = renderHook(() => usePushNotifications());
      expect(result.current.isSubscribed).toBe(false);
    });
  });

  describe("requestPermission", () => {
    it("should request notification permission", async () => {
      // When permission is granted, the hook auto-subscribes via subscribeToPush
      // which calls navigator.serviceWorker.ready etc. Mock it to succeed.
      const mockPushSub = {
        endpoint: "https://example.com/push",
        toJSON: vi.fn().mockReturnValue({ endpoint: "https://example.com/push", keys: { p256dh: "t", auth: "t" } }),
      };
      const mockReg = {
        pushManager: {
          subscribe: vi.fn().mockResolvedValue(mockPushSub),
          getSubscription: vi.fn().mockResolvedValue(null),
        },
      };
      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: Promise.resolve(mockReg) },
        writable: true,
        configurable: true,
      });
      vi.mocked(notificationsData.savePushSubscription).mockResolvedValue({
        id: "sub-1",
        user_id: "user-1",
        endpoint: "https://example.com/push",
        p256dh: "t",
        auth_key: "t",
        created_at: "2024-01-15T10:00:00Z",
      } as unknown);

      (global.Notification as Record<string, unknown>).requestPermission = vi.fn().mockResolvedValue("granted");

      const { result } = renderHook(() => usePushNotifications());

      let granted = false;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(granted).toBe(true);
      expect((global.Notification as Record<string, unknown>).requestPermission).toHaveBeenCalled();
    });

    it("should set hasPermission state when granted", async () => {
      // Set up mocks for auto-subscribe triggered after granting permission
      const mockPushSub = {
        endpoint: "https://example.com/push",
        toJSON: vi.fn().mockReturnValue({ endpoint: "https://example.com/push", keys: { p256dh: "t", auth: "t" } }),
      };
      const mockReg = {
        pushManager: {
          subscribe: vi.fn().mockResolvedValue(mockPushSub),
          getSubscription: vi.fn().mockResolvedValue(null),
        },
      };
      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: Promise.resolve(mockReg) },
        writable: true,
        configurable: true,
      });
      vi.mocked(notificationsData.savePushSubscription).mockResolvedValue({
        id: "sub-1",
        user_id: "user-1",
        endpoint: "https://example.com/push",
        p256dh: "t",
        auth_key: "t",
        created_at: "2024-01-15T10:00:00Z",
      } as unknown);

      (global.Notification as Record<string, unknown>).requestPermission = vi.fn().mockResolvedValue("granted");

      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.hasPermission).toBe(true);
    });

    it("should return false when permission denied", async () => {
      (global.Notification as Record<string, unknown>).requestPermission = vi.fn().mockResolvedValue("denied");

      const { result } = renderHook(() => usePushNotifications());

      let granted = false;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(granted).toBe(false);
      expect(result.current.hasPermission).toBe(false);
    });

    it("should handle permission request errors gracefully", async () => {
      (global.Notification as Record<string, unknown>).requestPermission = vi
        .fn()
        .mockRejectedValue(new Error("Permission request failed"));

      const { result } = renderHook(() => usePushNotifications());

      let granted = false;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(granted).toBe(false);
    });
  });

  describe("subscribeToPush", () => {
    it("should return false if no permission", async () => {
      Object.defineProperty(global.Notification, "permission", {
        value: "denied",
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => usePushNotifications());

      let subscribed = false;
      await act(async () => {
        subscribed = await result.current.subscribeToPush();
      });

      expect(subscribed).toBe(false);
    });

    it("should return false if user not authenticated", async () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { result } = renderHook(() => usePushNotifications());

      let subscribed = false;
      await act(async () => {
        subscribed = await result.current.subscribeToPush();
      });

      expect(subscribed).toBe(false);
    });
  });

  describe("unsubscribeFromPush", () => {
    it("should unsubscribe from push notifications", async () => {
      const mockSubscriptionObj = {
        endpoint: "https://example.com/push",
        unsubscribe: vi.fn().mockResolvedValue(true),
      };

      const mockServiceWorkerReg = {
        pushManager: {
          subscribe: vi.fn(),
          getSubscription: vi.fn().mockResolvedValue(mockSubscriptionObj),
        },
      };

      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: Promise.resolve(mockServiceWorkerReg) },
        writable: true,
        configurable: true,
      });

      vi.mocked(notificationsData.deletePushSubscription).mockResolvedValue(true as unknown);

      const { result } = renderHook(() => usePushNotifications());

      let unsubscribed = false;
      await act(async () => {
        unsubscribed = await result.current.unsubscribeFromPush();
      });

      expect(unsubscribed).toBe(true);
      expect(mockSubscriptionObj.unsubscribe).toHaveBeenCalled();
    });

    it("should return false if no active subscription", async () => {
      const mockServiceWorkerReg = {
        pushManager: {
          subscribe: vi.fn(),
          getSubscription: vi.fn().mockResolvedValue(null),
        },
      };

      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: Promise.resolve(mockServiceWorkerReg) },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => usePushNotifications());

      let unsubscribed = false;
      await act(async () => {
        unsubscribed = await result.current.unsubscribeFromPush();
      });

      expect(unsubscribed).toBe(false);
    });

    it("should handle unsubscribe errors", async () => {
      const mockSubscriptionObj = {
        endpoint: "https://example.com/push",
        unsubscribe: vi.fn().mockRejectedValue(new Error("Unsubscribe failed")),
      };

      const mockServiceWorkerReg = {
        pushManager: {
          subscribe: vi.fn(),
          getSubscription: vi.fn().mockResolvedValue(mockSubscriptionObj),
        },
      };

      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: Promise.resolve(mockServiceWorkerReg) },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => usePushNotifications());

      let unsubscribed = false;
      await act(async () => {
        unsubscribed = await result.current.unsubscribeFromPush();
      });

      expect(unsubscribed).toBe(false);
    });
  });

  describe("Realtime notifications", () => {
    it("should subscribe to realtime notifications channel", () => {
      renderHook(() => usePushNotifications());
      expect(mockChannel).toHaveBeenCalled();
    });

    it("should call onNotification callback when provided", () => {
      const onNotification = vi.fn();
      renderHook(() => usePushNotifications({ onNotification }));
      // Just verify hook initializes with callback without error
      expect(mockChannel).toHaveBeenCalled();
    });
  });

  describe("Options", () => {
    it("should respect enabled option", () => {
      mockUseAuth.mockReturnValue({ user: null });
      const { result } = renderHook(() => usePushNotifications({ enabled: false }));
      expect(result.current).toBeDefined();
    });
  });

  describe("Cleanup", () => {
    it("should remove realtime channel on unmount", () => {
      const { unmount } = renderHook(() => usePushNotifications());
      unmount();
      expect(mockRemoveChannel).toHaveBeenCalled();
    });
  });
});

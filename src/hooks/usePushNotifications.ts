/**
 * usePushNotifications — Browser Push Notifications with Notification API
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { savePushSubscription, deletePushSubscription } from "@/data/notifications";
import { supabase } from "@/integrations/supabase/client";

export interface UsePushNotificationsOptions {
  enabled?: boolean;
  onNotification?: (notification: any) => void;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const { user } = useAuth();
  const { enabled = true, onNotification } = options;
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);
    setHasPermission(Notification.permission === "granted");
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      setIsLoading(true);
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!user || !isSupported || !hasPermission) return false;

    try {
      setIsLoading(true);

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY,
      });

      // Save subscription to database
      const savedSubscription = await savePushSubscription(
        user.id,
        subscription.toJSON() as any,
        navigator.userAgent
      );

      if (savedSubscription) {
        setIsSubscribed(true);
        return true;
      }
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
    } finally {
      setIsLoading(false);
    }

    return false;
  }, [user, isSupported, hasPermission]);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async () => {
    if (!isSupported) return false;

    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await deletePushSubscription(subscription.endpoint);
        setIsSubscribed(false);
        return true;
      }
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
    } finally {
      setIsLoading(false);
    }

    return false;
  }, [isSupported]);

  // Subscribe to realtime notifications and show browser notifications when tab is not focused
  useEffect(() => {
    if (!user || !enabled) return;

    const channel = supabase
      .channel(`browser_notifications_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Only show browser notification if tab is not focused
          if (document.hidden) {
            const notification = payload.new;
            new Notification(notification.title, {
              body: notification.body,
              icon: "/icon-192.png",
              badge: "/badge-72.png",
              tag: notification.id,
              requireInteraction: notification.priority === "urgent",
            });
          }

          // Trigger callback
          onNotification?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, enabled, onNotification]);

  // Auto-subscribe if permission is granted
  useEffect(() => {
    if (isSupported && hasPermission && !isSubscribed && !isLoading && user) {
      subscribeToPush();
    }
  }, [isSupported, hasPermission, isSubscribed, isLoading, user, subscribeToPush]);

  return {
    isSupported,
    hasPermission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
  };
}

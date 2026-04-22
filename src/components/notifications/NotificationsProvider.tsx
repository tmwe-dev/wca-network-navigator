/**
 * NotificationsProvider — Global provider for toast notifications and push setup
 */
import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { NotificationToast } from "./NotificationToast";
import type { Notification } from "@/data/notifications";

interface ToastNotification extends Notification {
  toastId?: string;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const { requestPermission, subscribeToPush } = usePushNotifications({ enabled: false });

  // Handle incoming notifications
  const handleNewNotification = useCallback(
    (notification: ToastNotification) => {
      // Add unique toast ID
      const toastId = `${notification.id}_${Date.now()}`;
      setToasts((prev) => [{ ...notification, toastId }, ...prev.slice(0, 4)]);
    },
    []
  );

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications_toast_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          handleNewNotification(payload.new as ToastNotification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, handleNewNotification]);

  // Setup push notifications on user load
  useEffect(() => {
    if (!user) return;

    // Check if notifications are supported and setup
    const setupPushNotifications = async () => {
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          // Auto-subscribe if already granted
          subscribeToPush();
        } else if (Notification.permission !== "denied") {
          // Optionally request permission (can be triggered by user interaction)
          console.log("Push notification permission available");
        }
      }
    };

    setupPushNotifications();
  }, [user, subscribeToPush]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== id));
  }, []);

  return (
    <>
      {children}

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.toastId} className="pointer-events-auto">
            <NotificationToast
              notification={toast}
              onDismiss={dismissToast}
            />
          </div>
        ))}
      </div>
    </>
  );
}

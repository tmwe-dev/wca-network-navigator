/**
 * useNotifications — React Query hook for notification management with realtime subscription
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  createNotification,
  type Notification,
  type NotificationFilters,
  type CreateNotificationInput,
} from "@/data/notifications";
import { queryKeys } from "@/lib/queryKeys";

// ─── useNotifications ───────────────────────────────────

export function useNotifications(filters: NotificationFilters = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [queryKeys.notifications.list, filters],
    queryFn: () => (user ? listNotifications(user.id, filters) : Promise.resolve([])),
    enabled: !!user,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    // Unique channel name per effect instance to avoid StrictMode double-mount collisions.
    const channelName = `notifications_${user.id}_${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase.channel(channelName);
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate queries to refetch
          queryClient.invalidateQueries({
            queryKey: [queryKeys.notifications.list],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

// ─── useUnreadCount ─────────────────────────────────────

export function useUnreadCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [queryKeys.notifications.unreadCount],
    queryFn: () => (user ? getUnreadCount(user.id) : Promise.resolve(0)),
    enabled: !!user,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channelName = `notifications_count_${user.id}_${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase.channel(channelName);
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate unread count query
          queryClient.invalidateQueries({
            queryKey: [queryKeys.notifications.unreadCount],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

// ─── useMarkAsRead ──────────────────────────────────────

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.notifications.list],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.notifications.unreadCount],
      });
    },
  });
}

// ─── useMarkAllAsRead ───────────────────────────────────

export function useMarkAllAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => (user ? markAllAsRead(user.id) : Promise.resolve(0)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.notifications.list],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.notifications.unreadCount],
      });
    },
  });
}

// ─── useDismissNotification ──────────────────────────────

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.notifications.list],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.notifications.unreadCount],
      });
    },
  });
}

// ─── useCreateNotification ───────────────────────────────

export function useCreateNotification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateNotificationInput) =>
      user ? createNotification(user.id, input) : Promise.resolve(null),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.notifications.list],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.notifications.unreadCount],
      });
    },
  });
}

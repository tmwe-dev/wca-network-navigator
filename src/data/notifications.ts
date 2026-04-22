/**
 * Data Access Layer — Notifications
 * Single source of truth for all notifications table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// ─── Types ──────────────────────────────────────────────

export type NotificationType = 'email_received' | 'deal_stage_change' | 'ai_completed' | 'system_error' | 'outreach_reply' | 'reminder';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type EntityType = 'partner' | 'contact' | 'deal' | 'email';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body?: string;
  type: NotificationType;
  priority: NotificationPriority;
  read: boolean;
  dismissed: boolean;
  action_url?: string;
  entity_type?: EntityType;
  entity_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface NotificationFilters {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
  priority?: NotificationPriority;
}

export interface CreateNotificationInput {
  title: string;
  body?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  action_url?: string;
  entity_type?: EntityType;
  entity_id?: string;
  metadata?: Record<string, any>;
}

// ─── Queries ────────────────────────────────────────────

export async function listNotifications(
  userId: string,
  filters: NotificationFilters = {}
): Promise<Notification[]> {
  const { limit = 20, offset = 0, unreadOnly = false, type, priority } = filters;

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  if (type) {
    query = query.eq("type", type);
  }

  if (priority) {
    query = query.eq("priority", priority);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  return (data || []) as Notification[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false)
    .eq("dismissed", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }

  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<Notification | null> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) {
    console.error("Error marking notification as read:", error);
    return null;
  }

  return data as Notification;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const { error, count } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    console.error("Error marking all as read:", error);
    return 0;
  }

  return count || 0;
}

export async function dismissNotification(notificationId: string): Promise<Notification | null> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ dismissed: true })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) {
    console.error("Error dismissing notification:", error);
    return null;
  }

  return data as Notification;
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput
): Promise<Notification | null> {
  const { data, error } = await supabase
    .from("notifications")
    .insert([
      {
        user_id: userId,
        title: input.title,
        body: input.body,
        type: input.type,
        priority: input.priority || "normal",
        action_url: input.action_url,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        metadata: input.metadata || {},
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    return null;
  }

  return data as Notification;
}

export async function deleteOldNotifications(
  userId: string,
  daysOld: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { error, count } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .lt("created_at", cutoffDate.toISOString())
    .eq("dismissed", true);

  if (error) {
    console.error("Error deleting old notifications:", error);
    return 0;
  }

  return count || 0;
}

// ─── Push Subscriptions ──────────────────────────────

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  user_agent?: string;
  created_at: string;
}

export async function savePushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  userAgent?: string
): Promise<PushSubscription | null> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      [
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          user_agent: userAgent,
        },
      ],
      { onConflict: "user_id,endpoint" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error saving push subscription:", error);
    return null;
  }

  return data as PushSubscription;
}

export async function getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching push subscriptions:", error);
    return [];
  }

  return (data || []) as PushSubscription[];
}

export async function deletePushSubscription(endpoint: string): Promise<boolean> {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    console.error("Error deleting push subscription:", error);
    return false;
  }

  return true;
}

/**
 * NotificationItem — Single notification row component
 */
import React from "react";
import { X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Notification } from "@/data/notifications";

interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onClick: (notification: Notification) => void;
}

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  email_received: "📧",
  deal_stage_change: "📈",
  ai_completed: "🤖",
  system_error: "⚠️",
  outreach_reply: "💬",
  reminder: "🔔",
};

const NOTIFICATION_LABELS: Record<string, string> = {
  email_received: "Email ricevuta",
  deal_stage_change: "Cambio fase trattativa",
  ai_completed: "AI completata",
  system_error: "Errore sistema",
  outreach_reply: "Risposta outreach",
  reminder: "Promemoria",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
  normal: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  high: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  urgent: "bg-red-500/20 text-red-700 dark:text-red-300",
};

export function NotificationItem({
  notification,
  onDismiss,
  onClick,
}: NotificationItemProps): React.ReactElement {
  const relativeTime = formatDistanceToNow(new Date(notification.created_at), {
    locale: it,
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
        notification.read
          ? "bg-transparent hover:bg-secondary/50"
          : "bg-primary/5 hover:bg-primary/10"
      )}
      onClick={() => onClick(notification)}
    >
      {/* Icon */}
      <div className="text-xl shrink-0 mt-0.5">
        {NOTIFICATION_ICONS[notification.type] || "🔔"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4
            className={cn(
              "text-sm line-clamp-1",
              notification.read ? "font-normal" : "font-semibold"
            )}
          >
            {notification.title}
          </h4>
          {!notification.read && (
            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
          )}
        </div>

        {notification.body && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
            {notification.body}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
          <Badge variant="outline" className="text-xs capitalize">
            {NOTIFICATION_LABELS[notification.type] || notification.type}
          </Badge>
          {notification.priority !== "normal" && (
            <span className={cn("text-xs px-2 py-0.5 rounded", PRIORITY_COLORS[notification.priority])}>
              {notification.priority.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * NotificationCenter — Bell icon button with notification dropdown
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, useUnreadCount, useMarkAllAsRead, useDismissNotification, useMarkAsRead } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { cn } from "@/lib/utils";
import type { Notification } from "@/data/notifications";

export function NotificationCenter(): React.ReactElement {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [] } = useNotifications({ limit: 20 });
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAllAsRead = useMarkAllAsRead();
  const dismissNotification = useDismissNotification();
  const markAsRead = useMarkAsRead();

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }

    // Navigate if action_url exists
    if (notification.action_url) {
      navigate(notification.action_url);
      setIsOpen(false);
    }
  };

  const handleDismiss = (id: string) => {
    dismissNotification.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors relative"
          aria-label="Notifiche"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {Math.min(unreadCount, 99)}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0 rounded-lg shadow-lg" align="end">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-3 sticky top-0 bg-card/95 backdrop-blur-sm">
          <h2 className="font-semibold text-sm">Notifiche</h2>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              Segna tutte come lette
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nessuna notifica</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onDismiss={handleDismiss}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t p-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary"
              onClick={() => {
                navigate("/notifications");
                setIsOpen(false);
              }}
            >
              Vedi tutte →
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

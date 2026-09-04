/**
 * NotificationCenter — Bell icon button with notification dropdown.
 * `NotificationsBody` è il contenuto riutilizzabile (usato dall'hub di sistema).
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useUnreadCount,
  useMarkAllAsRead,
  useDismissNotification,
  useMarkAsRead,
} from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import type { Notification } from "@/hooks/useNotifications";

export function NotificationsBody({ onClose }: { onClose?: () => void }): React.ReactElement {
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications({ limit: 20 });
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAllAsRead = useMarkAllAsRead();
  const dismissNotification = useDismissNotification();
  const markAsRead = useMarkAsRead();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsRead.mutate(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
      onClose?.();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <h2 className="text-sm font-semibold">Notifiche</h2>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            Segna tutte come lette
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nessuna notifica</div>
      ) : (
        <ScrollArea className="h-[340px]">
          <div className="divide-y divide-border/40">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onDismiss={(id) => dismissNotification.mutate(id)}
                onClick={handleNotificationClick}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {notifications.length > 0 && (
        <div className="flex justify-center border-t border-border/40 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-primary"
            onClick={() => {
              navigate("/notifications");
              onClose?.();
            }}
          >
            Vedi tutte →
          </Button>
        </div>
      )}
    </div>
  );
}

export function NotificationCenter(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadCount();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-7 w-7 text-foreground transition-colors hover:text-primary"
          aria-label="Notifiche"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
            >
              {Math.min(unreadCount, 99)}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 rounded-lg p-3 shadow-lg" align="end">
        <NotificationsBody onClose={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * NotificationsPage — Full list of all notifications with filters
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, useDismissNotification, useMarkAsRead } from "@/hooks/useNotifications";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { Trash2, Mail, TrendingUp, Bot, AlertTriangle, MessageSquare, Clock } from "lucide-react";
import type { NotificationType, NotificationPriority, Notification } from "@/data/notifications";

export default function NotificationsPage(): React.ReactElement {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | "all">("all");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data: notifications = [] } = useNotifications({
    limit,
    offset,
    unreadOnly: readFilter === "unread",
    type: typeFilter !== "all" ? typeFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
  });

  const dismissNotification = useDismissNotification();
  const markAsRead = useMarkAsRead();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleDismiss = (id: string) => {
    dismissNotification.mutate(id);
  };

  const notificationTypeIcons: Record<string, React.ReactNode> = {
    email_received: <Mail className="h-4 w-4" />,
    deal_stage_change: <TrendingUp className="h-4 w-4" />,
    ai_completed: <Bot className="h-4 w-4" />,
    system_error: <AlertTriangle className="h-4 w-4" />,
    outreach_reply: <MessageSquare className="h-4 w-4" />,
    reminder: <Clock className="h-4 w-4" />,
  };

  const notificationTypeLabels: Record<string, string> = {
    email_received: "Email ricevuta",
    deal_stage_change: "Cambio fase trattativa",
    ai_completed: "AI completata",
    system_error: "Errore sistema",
    outreach_reply: "Risposta outreach",
    reminder: "Promemoria",
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifiche</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestisci tutte le tue notifiche in un unico posto
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
        >
          Indietro
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-secondary/30 rounded-lg">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="bg-background border-input">
            <SelectValue placeholder="Tipo notifica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="email_received">Email ricevuta</SelectItem>
            <SelectItem value="deal_stage_change">Cambio fase</SelectItem>
            <SelectItem value="ai_completed">AI completata</SelectItem>
            <SelectItem value="system_error">Errore sistema</SelectItem>
            <SelectItem value="outreach_reply">Risposta outreach</SelectItem>
            <SelectItem value="reminder">Promemoria</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
          <SelectTrigger className="bg-background border-input">
            <SelectValue placeholder="Priorità" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le priorità</SelectItem>
            <SelectItem value="low">Bassa</SelectItem>
            <SelectItem value="normal">Normale</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
          </SelectContent>
        </Select>

        <Select value={readFilter} onValueChange={(v) => setReadFilter(v as any)}>
          <SelectTrigger className="bg-background border-input">
            <SelectValue placeholder="Stato lettura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="unread">Non letti</SelectItem>
            <SelectItem value="read">Letti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nessuna notifica</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 border rounded-lg bg-card">
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="hover:bg-secondary/50 transition-colors"
              >
                <NotificationItem
                  notification={notification}
                  onDismiss={handleDismiss}
                  onClick={handleNotificationClick}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Pagination */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/20">
          <span className="text-sm text-muted-foreground">
            Mostrando {offset + 1} - {offset + notifications.length} di molti risultati
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={notifications.length < limit}
            >
              Successivo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

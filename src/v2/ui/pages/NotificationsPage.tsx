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
import { Trash2, Mail, TrendingUp, Bot, AlertTriangle, MessageSquare, Clock, Bell } from "lucide-react";
import type { NotificationType, NotificationPriority, Notification } from "@/data/notifications";
import { PageShell } from "@/v2/ui/templates/PageShell";

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
    <PageShell
      title="Notifiche"
      description="Gestisci tutte le tue notifiche in un unico posto"
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Indietro
        </Button>
      }
    >
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border border-border">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
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

        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}>
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

        <Select value={readFilter} onValueChange={(v) => setReadFilter(v as typeof readFilter)}>
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
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nessuna notifica</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh] border border-border rounded-lg bg-card">
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="hover:bg-muted/50 transition-colors"
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
        <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
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
    </PageShell>
  );
}

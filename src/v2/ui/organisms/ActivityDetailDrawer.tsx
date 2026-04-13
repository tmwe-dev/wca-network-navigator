/**
 * ActivityDetailDrawer — Activity detail side panel
 */
import * as React from "react";
import type { Activity } from "@/v2/core/domain/entities";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { isOverdue } from "@/v2/core/domain/rules/activity-rules";
import { X, Mail, Calendar, Clock, User, FileText, CheckCircle } from "lucide-react";

export interface ActivityDetailDrawerProps {
  readonly activity: Activity | null;
  readonly onClose: () => void;
  readonly onMarkComplete?: (id: string) => void;
}

export function ActivityDetailDrawer({
  activity,
  onClose,
  onMarkComplete,
}: ActivityDetailDrawerProps): React.ReactElement | null {
  if (!activity) return null;

  const overdue = isOverdue(activity);
  const statusMap: Record<string, "success" | "warning" | "error" | "neutral"> = {
    completed: "success", in_progress: "warning",
    pending: overdue ? "error" : "neutral", cancelled: "neutral",
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l bg-card shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-foreground truncate">{activity.title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="flex gap-2 flex-wrap">
          <StatusBadge status={statusMap[activity.status] ?? "neutral"} label={overdue ? "Scaduta" : activity.status} />
          <StatusBadge status="neutral" label={activity.activityType.replace(/_/g, " ")} />
          <StatusBadge status="neutral" label={`Priorità: ${activity.priority}`} />
        </div>

        {activity.description ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Descrizione</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{activity.description}</p>
          </div>
        ) : null}

        <div className="space-y-3">
          {activity.dueDate ? (
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Scadenza" value={new Date(activity.dueDate).toLocaleDateString("it-IT")} />
          ) : null}
          {activity.scheduledAt ? (
            <InfoRow icon={<Clock className="h-4 w-4" />} label="Programmato" value={new Date(activity.scheduledAt).toLocaleString("it-IT")} />
          ) : null}
          {activity.completedAt ? (
            <InfoRow icon={<CheckCircle className="h-4 w-4" />} label="Completato" value={new Date(activity.completedAt).toLocaleString("it-IT")} />
          ) : null}
          {activity.assignedTo ? (
            <InfoRow icon={<User className="h-4 w-4" />} label="Assegnato a" value={activity.assignedTo} />
          ) : null}
          <InfoRow icon={<FileText className="h-4 w-4" />} label="Sorgente" value={`${activity.sourceType} / ${activity.sourceId}`} />
        </div>

        {activity.emailSubject ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs text-muted-foreground font-medium">
              <Mail className="h-3 w-3 inline mr-1" />Email
            </p>
            <p className="text-sm font-medium">{activity.emailSubject}</p>
            {activity.emailBody ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap border rounded p-3 bg-background max-h-64 overflow-y-auto">
                {activity.emailBody}
              </div>
            ) : null}
            {activity.sentAt ? (
              <p className="text-xs text-muted-foreground">
                Inviata: {new Date(activity.sentAt).toLocaleString("it-IT")}
              </p>
            ) : null}
          </div>
        ) : null}

        {onMarkComplete && activity.status !== "completed" ? (
          <div className="border-t pt-4">
            <Button onClick={() => onMarkComplete(String(activity.id))} className="w-full gap-2">
              <CheckCircle className="h-4 w-4" /> Segna come completata
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface InfoRowProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps): React.ReactElement {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

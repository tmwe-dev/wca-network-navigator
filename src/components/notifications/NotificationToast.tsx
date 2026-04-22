/**
 * NotificationToast — Toast notification for new incoming notifications
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification } from "@/data/notifications";

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  autoCloseDuration?: number;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  email_received: "📧",
  deal_stage_change: "📈",
  ai_completed: "🤖",
  system_error: "⚠️",
  outreach_reply: "💬",
  reminder: "🔔",
};

const TOAST_COLORS: Record<string, string> = {
  email_received: "border-blue-500/50 bg-blue-500/10",
  deal_stage_change: "border-green-500/50 bg-green-500/10",
  ai_completed: "border-purple-500/50 bg-purple-500/10",
  system_error: "border-red-500/50 bg-red-500/10",
  outreach_reply: "border-orange-500/50 bg-orange-500/10",
  reminder: "border-yellow-500/50 bg-yellow-500/10",
};

export function NotificationToast({
  notification,
  onDismiss,
  autoCloseDuration = 5000,
}: NotificationToastProps): React.ReactElement {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss(notification.id);
    }, autoCloseDuration);

    return () => clearTimeout(timer);
  }, [notification.id, onDismiss, autoCloseDuration]);

  if (!isVisible) return <></>;

  const handleClick = () => {
    if (notification.action_url) {
      navigate(notification.action_url);
    }
    setIsVisible(false);
    onDismiss(notification.id);
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 max-w-sm border rounded-lg shadow-lg p-4 backdrop-blur-sm z-50 animate-slide-in-up",
        TOAST_COLORS[notification.type] || "border-primary/50 bg-primary/10"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">
          {NOTIFICATION_ICONS[notification.type] || "🔔"}
        </span>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground line-clamp-1">
            {notification.title}
          </h4>
          {notification.body && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {notification.body}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
            onDismiss(notification.id);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20 rounded-b-lg">
        <div
          className="h-full bg-primary rounded-b-lg"
          style={{
            animation: `shrink ${autoCloseDuration}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes slide-in-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in-up {
          animation: slide-in-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

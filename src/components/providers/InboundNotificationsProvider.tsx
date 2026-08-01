/**
 * Provider component that initializes global inbound email notifications
 * LOVABLE-93: notifiche real-time email inbound
 */

import { useInboundNotifications } from "@/hooks/useInboundNotifications";
import { useFunnemailUrgencyAlerts } from "@/hooks/useFunnemailUrgencyAlerts";

/**
 * Global notifications initializer component.
 * Mount this in the app root to enable real-time inbound email notifications.
 */
export function InboundNotificationsProvider({ children }: { children?: React.ReactNode }) {
  // Initialize the hook (this starts the realtime subscription)
  useInboundNotifications();
  // Realtime alert su classificazioni Funnemail urgency=critical|high
  useFunnemailUrgencyAlerts();

  // This is a headless provider — it doesn't render anything
  return <>{children}</>;
}

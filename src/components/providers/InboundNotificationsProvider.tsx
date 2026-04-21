/**
 * Provider component that initializes global inbound email notifications
 * LOVABLE-93: notifiche real-time email inbound
 */

import { useInboundNotifications } from "@/hooks/useInboundNotifications";

/**
 * Global notifications initializer component.
 * Mount this in the app root to enable real-time inbound email notifications.
 */
export function InboundNotificationsProvider({ children }: { children?: React.ReactNode }) {
  // Initialize the hook (this starts the realtime subscription)
  useInboundNotifications();

  // This is a headless provider — it doesn't render anything
  return <>{children}</>;
}

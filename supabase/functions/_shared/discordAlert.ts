/**
 * Sprint H — Discord webhook alert helper.
 *
 * Sends colour-coded embed messages to a Discord channel via webhook.
 */

type Severity = "info" | "warning" | "critical";

/** Discord embed colour mapped by severity. */
const SEVERITY_COLORS: Record<Severity, number> = {
  info: 0x3498db, // blue
  warning: 0xf1c40f, // yellow
  critical: 0xe74c3c, // red
};

const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp: string;
}

interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}

/**
 * Sends a colour-coded alert message to a Discord channel webhook.
 *
 * @param webhookUrl  Full Discord webhook URL.
 * @param message     Alert body text.
 * @param severity    One of "info" | "warning" | "critical".
 */
export async function sendDiscordAlert(webhookUrl: string, message: string, severity: Severity): Promise<void> {
  const payload: DiscordWebhookPayload = {
    embeds: [
      {
        title: `[${SEVERITY_LABELS[severity]}] WCA Alert`,
        description: message,
        color: SEVERITY_COLORS[severity],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
  }
}

// Re-export types for consumers
export type { Severity };
export { SEVERITY_COLORS };

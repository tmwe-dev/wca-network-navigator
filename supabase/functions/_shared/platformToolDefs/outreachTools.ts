/**
 * outreachTools.ts — Outreach, Email, and Messaging tool definitions.
 */

export const OUTREACH_TOOLS = [
  {
    type: "function",
    function: {
      name: "generate_outreach",
      description: "Generate outreach message (email, LinkedIn, WhatsApp, SMS).",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string" },
          contact_name: { type: "string" },
          contact_email: { type: "string" },
          company_name: { type: "string" },
          country_code: { type: "string" },
          language: { type: "string" },
          goal: { type: "string" },
          quality: { type: "string" },
        },
        required: ["channel", "contact_name", "company_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email.",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string" },
          to_name: { type: "string" },
          subject: { type: "string" },
          html_body: { type: "string" },
          partner_id: { type: "string" },
        },
        required: ["to_email", "subject", "html_body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_email",
      description: "Schedule an email to be sent at a specific date and time.",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string" },
          to_name: { type: "string" },
          subject: { type: "string" },
          html_body: { type: "string" },
          partner_id: { type: "string" },
          scheduled_at: { type: "string" },
        },
        required: ["to_email", "subject", "html_body", "scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queue_outreach",
      description: "Queue an outreach message to be sent automatically.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["email", "linkedin", "whatsapp", "sms"] },
          recipient_name: { type: "string" },
          recipient_email: { type: "string" },
          recipient_phone: { type: "string" },
          partner_id: { type: "string" },
          contact_id: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          priority: { type: "number" },
        },
        required: ["channel", "body"],
      },
    },
  },
];

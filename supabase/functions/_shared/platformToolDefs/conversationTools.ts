/**
 * conversationTools.ts — Inbox, Conversation, and Message thread tool definitions.
 */

export const CONVERSATION_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_inbox",
      description: "Read incoming messages from channel_messages.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["email", "whatsapp", "linkedin"] },
          unread_only: { type: "boolean" },
          partner_id: { type: "string" },
          from_date: { type: "string" },
          to_date: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_conversation_history",
      description: "Get unified timeline for a partner or contact.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          contact_id: { type: "string" },
          company_name: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_email_thread",
      description: "Get an email thread for a partner or email address.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          email_address: { type: "string" },
          thread_id: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_holding_pattern",
      description: "Get contacts in the holding pattern (first_touch_sent/holding).",
      parameters: {
        type: "object",
        properties: {
          source_type: { type: "string", enum: ["wca", "crm", "prospect", "all"] },
          country_code: { type: "string" },
          min_days_waiting: { type: "number" },
          max_days_waiting: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
  },
];

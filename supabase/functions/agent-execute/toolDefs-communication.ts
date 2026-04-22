// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMUNICATION & OUTREACH TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const COMMUNICATION_TOOLS: Record<string, unknown> = {
  generate_outreach: {
    type: "function",
    function: {
      name: "generate_outreach",
      description: "Generate outreach message (email, LinkedIn, WhatsApp, SMS).",
      parameters: {
        type: "object",
        properties: { channel: { type: "string" }, contact_name: { type: "string" }, contact_email: { type: "string" }, company_name: { type: "string" }, country_code: { type: "string" }, language: { type: "string" }, goal: { type: "string" }, quality: { type: "string" } },
        required: ["channel", "contact_name", "company_name"],
      },
    },
  },
  send_email: {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email.",
      parameters: {
        type: "object",
        properties: { to_email: { type: "string" }, to_name: { type: "string" }, subject: { type: "string" }, html_body: { type: "string" }, partner_id: { type: "string" } },
        required: ["to_email", "subject", "html_body"],
      },
    },
  },
  schedule_email: {
    type: "function",
    function: {
      name: "schedule_email",
      description: "Schedule an email to be sent at a specific date and time.",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string" }, to_name: { type: "string" },
          subject: { type: "string" }, html_body: { type: "string" },
          partner_id: { type: "string" },
          scheduled_at: { type: "string", description: "ISO 8601 datetime" },
        },
        required: ["to_email", "subject", "html_body", "scheduled_at"],
      },
    },
  },
  queue_outreach: {
    type: "function",
    function: {
      name: "queue_outreach",
      description: "Queue an outreach message to be sent automatically by the frontend.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["email", "linkedin", "whatsapp", "sms"] },
          recipient_name: { type: "string" }, recipient_email: { type: "string" },
          recipient_phone: { type: "string" }, recipient_linkedin_url: { type: "string" },
          partner_id: { type: "string" }, contact_id: { type: "string" },
          subject: { type: "string" }, body: { type: "string" }, priority: { type: "number" },
        },
        required: ["channel", "body"],
      },
    },
  },
  get_inbox: {
    type: "function",
    function: {
      name: "get_inbox",
      description: "Read incoming messages from channel_messages.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["email", "whatsapp", "linkedin"] },
          unread_only: { type: "boolean" }, partner_id: { type: "string" },
          from_date: { type: "string" }, to_date: { type: "string" }, limit: { type: "number" },
        },
      },
    },
  },
  get_conversation_history: {
    type: "function",
    function: {
      name: "get_conversation_history",
      description: "Get unified timeline for a partner or contact.",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, contact_id: { type: "string" }, company_name: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  get_email_thread: {
    type: "function",
    function: {
      name: "get_email_thread",
      description: "Get an email thread for a partner or email address.",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, email_address: { type: "string" }, thread_id: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  analyze_incoming_email: {
    type: "function",
    function: {
      name: "analyze_incoming_email",
      description: "Analyze an incoming email: sentiment, intent, suggested action, urgency.",
      parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
    },
  },
  update_message_status: {
    type: "function",
    function: {
      name: "update_message_status",
      description: "Mark a channel_message as read/processed.",
      parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
    },
  },
  get_holding_pattern: {
    type: "function",
    function: {
      name: "get_holding_pattern",
      description: "Get contacts in the holding pattern (contacted/in_progress).",
      parameters: {
        type: "object",
        properties: {
          source_type: { type: "string", enum: ["wca", "crm", "prospect", "all"] },
          country_code: { type: "string" }, min_days_waiting: { type: "number" },
          max_days_waiting: { type: "number" }, limit: { type: "number" },
        },
      },
    },
  },
  get_email_classifications: {
    type: "function",
    function: {
      name: "get_email_classifications",
      description: "Query email classifications with filters.",
      parameters: { type: "object", properties: { email_address: { type: "string" }, partner_id: { type: "string" }, category: { type: "string" }, limit: { type: "number" } } },
    },
  },
  get_conversation_context: {
    type: "function",
    function: {
      name: "get_conversation_context",
      description: "Get conversation context for an email address.",
      parameters: { type: "object", properties: { email_address: { type: "string" } }, required: ["email_address"] },
    },
  },
  get_address_rules: {
    type: "function",
    function: {
      name: "get_address_rules",
      description: "Get email address rules.",
      parameters: { type: "object", properties: { email_address: { type: "string" }, is_active: { type: "boolean" }, limit: { type: "number" } } },
    },
  },
};

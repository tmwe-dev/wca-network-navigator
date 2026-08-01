export const TOOLS_INBOX_SEARCH = [
  // ── Inbox & Conversations ──
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

  // ── Directory & Deep Search ──
  {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Directory scanning status for countries.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_search_partner",
      description: "Deep Search a partner (logo, social, web info).",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
          force: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_search_contact",
      description: "Deep Search a contact (LinkedIn, social).",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          contact_name: { type: "string" },
        },
      },
    },
  },

  // ── Business Cards ──
  {
    type: "function",
    function: {
      name: "search_business_cards",
      description: "Search business cards.",
      parameters: {
        type: "object",
        properties: {
          event_name: { type: "string" },
          company_name: { type: "string" },
          contact_name: { type: "string" },
          email: { type: "string" },
          match_status: { type: "string" },
          has_partner_match: { type: "boolean" },
          has_contact_match: { type: "boolean" },
          met_after: { type: "string" },
          met_before: { type: "string" },
          lead_status: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },

];

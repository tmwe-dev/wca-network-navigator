// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTIVITY, NOTES, REMINDERS & BUSINESS CARDS TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ACTIVITY_TOOLS: Record<string, unknown> = {
  list_reminders: {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List reminders.",
      parameters: { type: "object", properties: { status: { type: "string" }, priority: { type: "string" }, partner_name: { type: "string" } } },
    },
  },
  add_partner_note: {
    type: "function",
    function: {
      name: "add_partner_note",
      description: "Add a note/interaction to a partner.",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, company_name: { type: "string" }, subject: { type: "string" }, notes: { type: "string" }, interaction_type: { type: "string" } },
        required: ["subject"],
      },
    },
  },
  create_reminder: {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a reminder for a partner.",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, company_name: { type: "string" }, title: { type: "string" }, description: { type: "string" }, due_date: { type: "string" }, priority: { type: "string" } },
        required: ["title", "due_date"],
      },
    },
  },
  update_reminder: {
    type: "function",
    function: {
      name: "update_reminder",
      description: "Update or delete a reminder.",
      parameters: {
        type: "object",
        properties: { reminder_id: { type: "string" }, status: { type: "string" }, priority: { type: "string" }, due_date: { type: "string" }, delete: { type: "boolean" } },
        required: ["reminder_id"],
      },
    },
  },
  list_activities: {
    type: "function",
    function: {
      name: "list_activities",
      description: "List activities from the agenda.",
      parameters: {
        type: "object",
        properties: { status: { type: "string" }, activity_type: { type: "string" }, partner_name: { type: "string" }, due_before: { type: "string" }, due_after: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  create_activity: {
    type: "function",
    function: {
      name: "create_activity",
      description: "Create a new activity.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" }, activity_type: { type: "string" }, partner_id: { type: "string" }, company_name: { type: "string" }, due_date: { type: "string" }, priority: { type: "string" }, email_subject: { type: "string" }, email_body: { type: "string" } },
        required: ["title", "activity_type"],
      },
    },
  },
  update_activity: {
    type: "function",
    function: {
      name: "update_activity",
      description: "Update an activity.",
      parameters: {
        type: "object",
        properties: { activity_id: { type: "string" }, status: { type: "string" }, priority: { type: "string" }, due_date: { type: "string" } },
        required: ["activity_id"],
      },
    },
  },
  search_business_cards: {
    type: "function",
    function: {
      name: "search_business_cards",
      description: "Search business cards.",
      parameters: { type: "object", properties: { event_name: { type: "string" }, company_name: { type: "string" }, contact_name: { type: "string" }, match_status: { type: "string" }, limit: { type: "number" } } },
    },
  },
  delete_records: {
    type: "function",
    function: {
      name: "delete_records",
      description: "Delete records from the system.",
      parameters: {
        type: "object",
        properties: { table: { type: "string" }, ids: { type: "array", items: { type: "string" } } },
        required: ["table", "ids"],
      },
    },
  },
};

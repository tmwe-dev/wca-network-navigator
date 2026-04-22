/**
 * activitiesTools.ts — Activities and Reminders tool definitions.
 */

export const ACTIVITIES_TOOLS = [
  // ── Activities ──
  {
    type: "function",
    function: {
      name: "list_activities",
      description: "List activities from the agenda.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          activity_type: { type: "string" },
          partner_name: { type: "string" },
          due_before: { type: "string" },
          due_after: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_activity",
      description: "Create a new activity.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          activity_type: { type: "string" },
          partner_id: { type: "string" },
          company_name: { type: "string" },
          due_date: { type: "string" },
          priority: { type: "string" },
          email_subject: { type: "string" },
          email_body: { type: "string" },
        },
        required: ["title", "activity_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_activity",
      description: "Update an activity.",
      parameters: {
        type: "object",
        properties: {
          activity_id: { type: "string" },
          status: { type: "string" },
          priority: { type: "string" },
          due_date: { type: "string" },
        },
        required: ["activity_id"],
      },
    },
  },

  // ── Reminders ──
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List reminders.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          priority: { type: "string" },
          partner_name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a reminder for a partner.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          due_date: { type: "string" },
          priority: { type: "string" },
        },
        required: ["title", "due_date"],
      },
    },
  },
];

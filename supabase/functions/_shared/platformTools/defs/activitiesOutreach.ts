export const TOOLS_ACTIVITIES_OUTREACH = [
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

  // ── Memory ──
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory to persistent storage.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          memory_type: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          importance: { type: "number" },
        },
        required: ["content", "memory_type", "tags"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search persistent memory.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" } },
          search_text: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },

  // ── Outreach & Email ──
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

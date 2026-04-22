/**
 * toolDefs-writing.ts — Data modification & writing tool definitions
 * Categories: Partner Updates, Contact Management, Activities, Email
 */

import type { ToolDefinition } from "./toolDefinitions.ts";

export const WRITING_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "update_partner",
      description: "Update specific fields of a partner. Supports: is_favorite, lead_status, rating, company_alias. Resolves company_name to partner_id automatically.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
          is_favorite: { type: "boolean", description: "Set as favorite" },
          lead_status: { type: "string", enum: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"], description: "Lead status" },
          rating: { type: "number", description: "Rating 0-5" },
          company_alias: { type: "string", description: "Short alias for the company" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_partner_note",
      description: "Add a note or interaction log to a partner. Creates an entry in the interactions table.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
          subject: { type: "string", description: "Note subject/title" },
          notes: { type: "string", description: "Note content" },
          interaction_type: { type: "string", enum: ["note", "email", "phone_call", "meeting", "other"], description: "Type of interaction (default: note)" },
        },
        required: ["subject"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a reminder/task associated with a partner. Sets a due date and priority.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
          title: { type: "string", description: "Reminder title" },
          description: { type: "string", description: "Reminder description" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level (default: medium)" },
        },
        required: ["title", "due_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update lead status of imported contacts. Can target specific IDs or filter by company_name/country.",
      parameters: {
        type: "object",
        properties: {
          contact_ids: { type: "array", items: { type: "string" }, description: "Array of contact UUIDs" },
          company_name: { type: "string", description: "Filter contacts by company name (partial match)" },
          country: { type: "string", description: "Filter contacts by country" },
          status: { type: "string", enum: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"], description: "New lead status" },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update_partners",
      description: "Update multiple partners at once. Filter by country_code or provide partner_ids. Supports updating is_favorite and lead_status.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "ISO 2-letter country code to filter" },
          partner_ids: { type: "array", items: { type: "string" }, description: "Array of partner UUIDs" },
          is_favorite: { type: "boolean", description: "Set favorite status" },
          lead_status: { type: "string", enum: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"], description: "Set lead status" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_partner_contact",
      description: "Add, update, or delete a contact person for a partner.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "update", "delete"], description: "Action to perform" },
          contact_id: { type: "string", description: "UUID of existing contact (for update/delete)" },
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name (to resolve partner_id)" },
          name: { type: "string", description: "Contact full name" },
          title: { type: "string", description: "Job title/role" },
          email: { type: "string", description: "Email address" },
          direct_phone: { type: "string", description: "Direct phone" },
          mobile: { type: "string", description: "Mobile phone" },
          is_primary: { type: "boolean", description: "Set as primary contact" },
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_reminder",
      description: "Update or complete/delete a reminder.",
      parameters: {
        type: "object",
        properties: {
          reminder_id: { type: "string", description: "UUID of the reminder" },
          status: { type: "string", enum: ["pending", "completed"], description: "New status" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_date: { type: "string", description: "New due date (YYYY-MM-DD)" },
          delete: { type: "boolean", description: "Delete the reminder" },
        },
        required: ["reminder_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_records",
      description: "Delete records from the system. Supports partners, contacts, prospects, activities. ALWAYS ask for confirmation before deleting.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", enum: ["partners", "imported_contacts", "prospects", "activities", "reminders"], description: "Table to delete from" },
          ids: { type: "array", items: { type: "string" }, description: "Array of UUIDs to delete" },
        },
        required: ["table", "ids"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_activities",
      description: "List activities/tasks from the agenda. Filter by status, type, source, partner, due date.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
          activity_type: { type: "string", enum: ["email", "phone_call", "meeting", "follow_up", "research", "linkedin_message", "whatsapp", "sms", "other"] },
          source_type: { type: "string", enum: ["partner", "prospect", "contact"] },
          partner_name: { type: "string", description: "Filter by partner company name" },
          due_before: { type: "string", description: "Due date before (YYYY-MM-DD)" },
          due_after: { type: "string", description: "Due date after (YYYY-MM-DD)" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_activity",
      description: "Create a new activity/task in the agenda. Can be linked to a partner, prospect, or contact.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Activity title" },
          description: { type: "string" },
          activity_type: { type: "string", enum: ["email", "phone_call", "meeting", "follow_up", "research", "linkedin_message", "whatsapp", "sms", "other"] },
          source_type: { type: "string", enum: ["partner", "prospect", "contact"], description: "Entity type (default: partner)" },
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to resolve partner_id" },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          email_subject: { type: "string" },
          email_body: { type: "string" },
        },
        required: ["title", "activity_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_activity",
      description: "Update an activity's status, priority, due date, or mark as completed.",
      parameters: {
        type: "object",
        properties: {
          activity_id: { type: "string", description: "UUID of the activity" },
          status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_date: { type: "string" },
        },
        required: ["activity_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_outreach",
      description: "Generate an outreach message (email, LinkedIn, WhatsApp, SMS) for a contact using AI. Returns subject + body ready to send or review.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["email", "linkedin", "whatsapp", "sms"], description: "Communication channel" },
          contact_name: { type: "string", description: "Recipient name" },
          contact_email: { type: "string", description: "Recipient email (for email channel)" },
          company_name: { type: "string", description: "Recipient company" },
          country_code: { type: "string", description: "ISO country code for language detection" },
          language: { type: "string", description: "Override language (it, en, es, fr, de, pt)" },
          goal: { type: "string", description: "Goal of the message (e.g. 'proposta di collaborazione')" },
          base_proposal: { type: "string", description: "Base proposal text to include" },
          quality: { type: "string", enum: ["fast", "standard", "premium"], description: "Generation quality" },
        },
        required: ["channel", "contact_name", "company_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email to a partner contact. Requires recipient email, subject, and HTML body. The email is sent via the configured SMTP server.",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string", description: "Recipient email address" },
          to_name: { type: "string", description: "Recipient name" },
          subject: { type: "string", description: "Email subject" },
          html_body: { type: "string", description: "Email body in HTML format" },
          partner_id: { type: "string", description: "Partner UUID (for tracking)" },
        },
        required: ["to_email", "subject", "html_body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new contact in the CRM (imported_contacts). Automatically triggers WCA partner matching if email or company_name is provided.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact full name" },
          email: { type: "string", description: "Email address" },
          company_name: { type: "string", description: "Company name" },
          phone: { type: "string", description: "Phone number" },
          mobile: { type: "string", description: "Mobile number" },
          position: { type: "string", description: "Job title / position" },
          city: { type: "string", description: "City" },
          country: { type: "string", description: "Country name or code" },
          origin: { type: "string", description: "Lead origin / source" },
          lead_status: { type: "string", enum: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"], description: "Lead status (default: new)" },
          note: { type: "string", description: "Optional note about the contact" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_email",
      description: "Queue a scheduled email in the outreach queue. The email will be sent at the specified time.",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string", description: "Recipient email address" },
          to_name: { type: "string", description: "Recipient name" },
          subject: { type: "string", description: "Email subject" },
          html_body: { type: "string", description: "Email HTML body" },
          partner_id: { type: "string", description: "Optional partner UUID for tracking" },
          scheduled_at: { type: "string", description: "ISO 8601 datetime for sending (e.g. 2026-04-17T09:00:00Z)" },
        },
        required: ["to_email", "subject", "html_body"],
        additionalProperties: false,
      },
    },
  },
];

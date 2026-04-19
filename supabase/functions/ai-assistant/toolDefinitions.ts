/**
 * toolDefinitions.ts — AI tool definitions array.
 * Extracted from ai-assistant/index.ts (lines 432-1377).
 */

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_partners",
      description: "Search and filter partners across the database. Supports filtering by country, city, name, rating, email/phone/profile presence, office type, favorites, branches, and services. Can return full results or just a count.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "ISO 2-letter country code" },
          city: { type: "string", description: "City name (partial match)" },
          search_name: { type: "string", description: "Company name (partial match)" },
          has_email: { type: "boolean", description: "Has email address" },
          has_phone: { type: "boolean", description: "Has phone number (in partner_contacts)" },
          has_profile: { type: "boolean", description: "Has profile description (sourced from WCA sync — populated for ≥99% of records)" },
          min_rating: { type: "number", description: "Minimum rating (0-5)" },
          office_type: { type: "string", enum: ["head_office", "branch"], description: "Filter by office type" },
          is_favorite: { type: "boolean", description: "Filter favorites only" },
          has_branches: { type: "boolean", description: "Has branch offices" },
          service: { type: "string", enum: ["air_freight","ocean_fcl","ocean_lcl","road_freight","rail_freight","project_cargo","dangerous_goods","perishables","pharma","ecommerce","relocations","customs_broker","warehousing","nvocc"], description: "Filter by service category" },
          certification: { type: "string", enum: ["IATA","BASC","ISO","C-TPAT","AEO"], description: "Filter by certification" },
          network_name: { type: "string", description: "Filter by network membership name" },
          sort_by: { type: "string", enum: ["rating", "name", "recent", "seniority"], description: "Sort order. 'seniority' = longest WCA membership first (by member_since)" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
          count_only: { type: "boolean", description: "Return only the count" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Get aggregated statistics per country: total partners, profiles, emails, phones.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional: specific country code" },
          sort_by: { type: "string", enum: ["total", "missing_profiles", "missing_emails"], description: "How to rank countries" },
          limit: { type: "number", description: "Max countries to return (default 30)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Check data coverage status for countries: internal coverage and sync quality indicators.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional: specific country code" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List asynchronous jobs with their status, progress, and errors.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["running", "pending", "completed", "cancelled"] },
          country_code: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a specific partner: company info, contacts, networks, services, certifications, social links, blacklist status.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database: total partners, countries, profiles, emails, phones, directory coverage, active jobs.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies flagged for payment issues.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          country: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List reminders associated with partners.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "completed"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          partner_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partners_without_contacts",
      description: "List partners with no contact information.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  // Download/scansioni WCA esclusi dai workflow AI conversazionali.
  // Se mancano dati qualitativi, usare deep_search_partner o enrich_partner_website.

  // ━━━ Memory & Plans Tools ━━━
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory (decision, preference, fact, conversation insight) to persistent storage. Use when the user expresses a preference, makes a decision, or when you learn something important. Always add relevant tags for fast retrieval.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "What to remember (clear, concise)" },
          memory_type: { type: "string", enum: ["conversation", "decision", "preference", "fact"], description: "Type of memory" },
          tags: { type: "array", items: { type: "string" }, description: "Semantic tags for fast retrieval (e.g. 'download', 'germania', 'email')" },
          importance: { type: "number", description: "1-5 scale, 5 = critical preference" },
          context_page: { type: "string", description: "Page context where this was learned" },
        },
        required: ["content", "memory_type", "tags"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search persistent memory by tags or text. Use to recall user preferences, past decisions, or operational history before answering.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" }, description: "Tags to search for (OR match)" },
          search_text: { type: "string", description: "Text to search in memory content" },
          memory_type: { type: "string", enum: ["conversation", "decision", "preference", "fact"] },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_work_plan",
      description: "Create a multi-step work plan. Each step defines an action with parameters. The plan will be executed step by step. Use for complex multi-action requests.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Plan title" },
          description: { type: "string", description: "What this plan accomplishes" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", description: "Tool name or action to execute" },
                params: { type: "object", description: "Parameters for the action" },
                description: { type: "string", description: "Human-readable step description" },
              },
              required: ["action", "description"],
            },
            description: "Ordered list of steps",
          },
          tags: { type: "array", items: { type: "string" }, description: "Tags for categorization and template matching" },
        },
        required: ["title", "steps", "tags"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_plan_step",
      description: "Execute the next pending step of an active work plan. Returns the step result and updates plan progress.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "UUID of the work plan" },
        },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_plans",
      description: "List active work plans (draft, running, paused). Shows progress and current step.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_as_template",
      description: "Save a completed work plan as a reusable template for future use.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "UUID of the completed plan to templatize" },
          name: { type: "string", description: "Template name" },
          description: { type: "string", description: "What this template does" },
        },
        required: ["plan_id", "name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_templates",
      description: "Search saved plan templates by tags or name. Returns reusable workflow blueprints.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" } },
          search_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_ui_action",
      description: "Execute a UI action on the frontend: navigate to a page, show a toast notification, apply filters, or open a dialog. The action will be dispatched as a CustomEvent to the frontend.",
      parameters: {
        type: "object",
        properties: {
          action_type: { type: "string", enum: ["navigate", "show_toast", "apply_filters", "open_dialog"], description: "Type of UI action" },
          path: { type: "string", description: "For navigate: the route path (e.g. /partner-hub)" },
          message: { type: "string", description: "For show_toast: the notification message" },
          toast_type: { type: "string", enum: ["default", "success", "error"], description: "Toast variant" },
          filters: { type: "object", description: "For apply_filters: filter key-value pairs" },
          dialog: { type: "string", description: "For open_dialog: dialog identifier" },
        },
        required: ["action_type"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Writing Tools ━━━
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
  // ━━━ Business Card Tools ━━━
  {
    type: "function",
    function: {
      name: "search_business_cards",
      description: "Search business cards by event, date, name, or company. Returns matched partner/contact info.",
      parameters: {
        type: "object",
        properties: {
          event_name: { type: "string", description: "Event name (partial match)" },
          company_name: { type: "string", description: "Company name (partial match)" },
          contact_name: { type: "string", description: "Contact name (partial match)" },
          match_status: { type: "string", enum: ["pending", "matched", "unmatched", "manual"], description: "Match status filter" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "link_business_card",
      description: "Manually link a business card to a partner or contact. Overrides automatic matching.",
      parameters: {
        type: "object",
        properties: {
          card_id: { type: "string", description: "UUID of the business card" },
          partner_id: { type: "string", description: "UUID of the partner to link" },
          contact_id: { type: "string", description: "UUID of the imported contact to link" },
        },
        required: ["card_id"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Verification / Status Check Tool ━━━
  {
    type: "function",
    function: {
      name: "check_job_status",
      description: "Check the real-time status of a specific background job, or get a summary of all active background processes (jobs, email queue). Use AFTER triggering any asynchronous action to verify its outcome.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "UUID of a specific background job to check. If omitted, returns a summary of ALL active processes." },
          include_email_queue: { type: "boolean", description: "Also check email campaign queue status (default: true)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Contacts (imported_contacts) Tools ━━━
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search imported contacts (CRM). Filter by name, company, country, email, origin, lead_status, group (import_log_id).",
      parameters: {
        type: "object",
        properties: {
          search_name: { type: "string", description: "Contact name (partial match)" },
          company_name: { type: "string", description: "Company name (partial match)" },
          country: { type: "string", description: "Country (partial match)" },
          email: { type: "string", description: "Email (partial match)" },
          origin: { type: "string", description: "Origin/source filter" },
          lead_status: { type: "string", enum: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"] },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
          count_only: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details of an imported contact including interactions and enrichment data.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "UUID of the contact" },
          contact_name: { type: "string", description: "Name to search (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Prospects Tools ━━━
  {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Search Italian prospects (Report Aziende). Filter by company name, city, province, codice_ateco, fatturato range, lead_status.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Company name (partial match)" },
          city: { type: "string", description: "City (partial match)" },
          province: { type: "string", description: "Province code" },
          region: { type: "string", description: "Region" },
          codice_ateco: { type: "string", description: "ATECO code (partial match)" },
          min_fatturato: { type: "number", description: "Minimum revenue" },
          max_fatturato: { type: "number", description: "Maximum revenue" },
          lead_status: { type: "string", enum: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"] },
          has_email: { type: "boolean" },
          limit: { type: "number", description: "Max results (default 20)" },
          count_only: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Activities Tools ━━━
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
  // ━━━ Email Generation & Sending Tools ━━━
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
  // ━━━ Deep Search & Enrichment Tools ━━━
  {
    type: "function",
    function: {
      name: "deep_search_partner",
      description: "Run a Deep Search on a partner to find additional info from the web (logo, social links, company details). Uses Partner Connect extension. Costs credits.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name (if ID not known)" },
          force: { type: "boolean", description: "Force re-search even if already enriched" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_search_contact",
      description: "Run a Deep Search on an imported contact to find LinkedIn, social profiles, and additional info. Costs credits.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "UUID of the imported contact" },
          contact_name: { type: "string", description: "Contact name (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enrich_partner_website",
      description: "Scrape and analyze a partner's website to extract services, capabilities, and company description. Costs credits.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  // scan_directory escluso dai workflow AI conversazionali.
  // Per gap qualitativi usare deep_search_partner / enrich_partner_website.

  // ━━━ Alias Generation Tool ━━━
  {
    type: "function",
    function: {
      name: "generate_aliases",
      description: "Generate short aliases for partner companies or contacts using AI. Can process single or batch.",
      parameters: {
        type: "object",
        properties: {
          partner_ids: { type: "array", items: { type: "string" }, description: "Array of partner UUIDs to generate aliases for" },
          country_code: { type: "string", description: "Generate aliases for all partners in this country" },
          type: { type: "string", enum: ["company", "contact"], description: "Alias type (default: company)" },
          limit: { type: "number", description: "Max partners to process (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  // ━━━ Partner Contact Management ━━━
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
  // ━━━ Reminder Management ━━━
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
  // ━━━ Delete Operations ━━━
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
  // ━━━ Procedure Knowledge Base Tool ━━━
  {
    type: "function",
    function: {
      name: "get_procedure",
      description: "Get detailed step-by-step procedure from the Operations Knowledge Base. Use when the user asks how to do something or when you need to follow a specific workflow. Returns prerequisites, ordered steps with tool mapping, and tips.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string", description: "Procedure ID (e.g. 'email_single', 'download_profiles', 'deep_search_partner')" },
          search_tags: { type: "array", items: { type: "string" }, description: "Tags to search for matching procedures (e.g. ['email', 'campagna'])" },
        },
        additionalProperties: false,
      },
    },
  },
  // ── Wave 4 — Enterprise tools ────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "search_kb",
      description: "Search the Knowledge Base for active rules/articles matching a free-text query (semantic via RAG). Use to RECALL existing knowledge BEFORE asking the user. Returns matching KB entries with similarity score.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text query to match against KB entries" },
          categories: { type: "array", items: { type: "string" }, description: "Optional category filter (e.g. ['cold_outreach','negoziazione'])" },
          limit: { type: "number", description: "Max results (default 6, max 20)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_kb_rule",
      description: "Save a reusable rule to the Knowledge Base. Use when you detect a repeated pattern, standard procedure, or correction that should apply to FUTURE interactions (not just this session). Triggers: user correction, repeated pattern across 2+ partners, explicit user 'always do X' instruction.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short descriptive title" },
          content: { type: "string", description: "Rule body (full text the AI will read)" },
          category: { type: "string", description: "Category (e.g. 'cold_outreach','negoziazione','filosofia','regole_sistema')" },
          tags: { type: "array", items: { type: "string" }, description: "Tags for filtering" },
          priority: { type: "number", description: "Priority 1-10 (default 5)" },
          chapter: { type: "string", description: "Optional chapter/section label" },
        },
        required: ["title", "content", "category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_operative_prompt",
      description: "Save a structured operative prompt for a recurring complex scenario. Use when you've executed a 3+ step process that the user might want to standardize and replay (e.g. 'partner onboarding checklist', 'silent client recovery'). Schema: name, objective, procedure (steps array), criteria (success criteria array).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Prompt name (e.g. 'Recovery Cliente Silente')" },
          objective: { type: "string", description: "What this prompt achieves" },
          procedure: { type: "string", description: "Step-by-step procedure (numbered list as text)" },
          criteria: { type: "string", description: "Success criteria / exit conditions" },
          priority: { type: "number", description: "Priority 1-10 (default 7)" },
        },
        required: ["name", "objective", "procedure", "criteria"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workflows",
      description: "List available commercial workflow templates and active workflows on partners. Use when the user asks 'what workflows do I have' or before starting/advancing a workflow.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "If provided, return active workflow state for this partner" },
          templates_only: { type: "boolean", description: "If true, return only template definitions" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_workflow",
      description: "Start a commercial workflow for a partner (or contact). Use when the user wants to formally begin a structured process like 'lead qualification', 'recovery silent partner', 'post event followup'.",
      parameters: {
        type: "object",
        properties: {
          workflow_code: { type: "string", description: "Workflow code (e.g. 'lead_qualification','recovery_silent_partner','post_event_followup')" },
          partner_id: { type: "string", description: "Target partner UUID" },
          contact_id: { type: "string", description: "Optional target contact UUID" },
          notes: { type: "string", description: "Initial context notes" },
        },
        required: ["workflow_code", "partner_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "advance_workflow_gate",
      description: "Advance a partner's active workflow to the next gate (or back to a previous one). VINCOLO: avanzamento massimo +1 alla volta. NON usare se gli exit criteria del gate corrente non sono soddisfatti — informa l'utente invece.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "Partner UUID with active workflow" },
          new_gate: { type: "number", description: "New gate index (max current+1, or any lower for rollback)" },
          gate_notes: { type: "string", description: "Notes/decisions taken in this gate" },
          status: { type: "string", enum: ["active","paused","completed","aborted"], description: "Optional new status" },
        },
        required: ["partner_id", "new_gate"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_playbooks",
      description: "List active commercial playbooks. Use to discover applicable playbooks for the current situation, or when the user asks 'what playbooks do I have'.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional ISO country code to match trigger conditions" },
          lead_status: { type: "string", description: "Optional lead status filter" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_playbook",
      description: "Apply a commercial playbook for a partner. Loads the playbook prompt template, KB tags, and suggested actions into the current context. Use when the situation matches a playbook's trigger conditions or when the user explicitly requests it.",
      parameters: {
        type: "object",
        properties: {
          playbook_code: { type: "string", description: "Playbook code" },
          partner_id: { type: "string", description: "Target partner UUID (optional)" },
        },
        required: ["playbook_code"],
        additionalProperties: false,
      },
    },
  },
  // ── Wave 5 — Intelligence & Arena tools ──
  {
    type: "function",
    function: {
      name: "get_email_classifications",
      description: "Query email classifications with filters. Returns category, confidence, summary, sentiment.",
      parameters: {
        type: "object",
        properties: {
          email_address: { type: "string", description: "Filter by email address" },
          partner_id: { type: "string", description: "Filter by partner UUID" },
          category: { type: "string", description: "Filter by category" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_conversation_context",
      description: "Get conversation context for an email address: history, sentiment, response rate.",
      parameters: {
        type: "object",
        properties: {
          email_address: { type: "string", description: "Email address to look up" },
        },
        required: ["email_address"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_address_rules",
      description: "Get email address rules: auto-execute settings, tone, topics, confidence threshold.",
      parameters: {
        type: "object",
        properties: {
          email_address: { type: "string", description: "Filter by email address" },
          is_active: { type: "boolean", description: "Filter by active status" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_next_contacts",
      description: "Suggest never-contacted partners for outreach. Calls AI Arena suggest internally.",
      parameters: {
        type: "object",
        properties: {
          focus: { type: "string", enum: ["tutti", "italia", "estero"], description: "Geographic focus" },
          channel: { type: "string", enum: ["email", "whatsapp", "linkedin"], description: "Preferred channel" },
          batch_size: { type: "number", description: "Number of suggestions (1-10)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detect_language",
      description: "Detect the appropriate language for a country code.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "ISO 2-letter country code" },
        },
        required: ["country_code"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ Pending Actions Tools ━━━
  {
    type: "function",
    function: {
      name: "get_pending_actions",
      description: "Get AI pending actions for the current user. Shows actions the AI has suggested but that need human approval.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "rejected", "executed"], description: "Filter by status (default: pending)" },
          action_type: { type: "string", description: "Filter by action type" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approve_ai_action",
      description: "Approve a pending AI action, marking it ready for execution.",
      parameters: {
        type: "object",
        properties: {
          action_id: { type: "string", description: "UUID of the pending action to approve" },
        },
        required: ["action_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reject_ai_action",
      description: "Reject a pending AI action with an optional reason.",
      parameters: {
        type: "object",
        properties: {
          action_id: { type: "string", description: "UUID of the pending action to reject" },
          reason: { type: "string", description: "Reason for rejection" },
        },
        required: ["action_id"],
        additionalProperties: false,
      },
    },
  },
  // ━━━ NEW: Missing parity tools ━━━
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
      name: "create_campaign",
      description: "Create an outreach mission (campaign) in draft status. Configure target filters, channel, and AI prompt for email generation.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Campaign title" },
          channel: { type: "string", enum: ["email", "whatsapp", "linkedin"], description: "Primary channel (default: email)" },
          target_filters: { type: "object", description: "Filters to select recipients: country_code, lead_status, has_email, etc." },
          ai_prompt: { type: "string", description: "AI prompt for generating outreach messages" },
          template_id: { type: "string", description: "Optional template ID for message generation" },
        },
        required: ["title"],
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
  {
    type: "function",
    function: {
      name: "update_agent_prompt",
      description: "Update an AI agent's system prompt. Can replace the entire prompt or append additional instructions.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "Agent name to find" },
          agent_id: { type: "string", description: "Agent UUID (if known)" },
          replace_prompt: { type: "string", description: "Full replacement system prompt" },
          prompt_addition: { type: "string", description: "Text to append to the existing prompt" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_agent_kb_entry",
      description: "Add a knowledge base entry linked to an AI agent. The entry becomes part of the agent's context for future interactions.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "Agent name to find" },
          agent_id: { type: "string", description: "Agent UUID (if known)" },
          title: { type: "string", description: "KB entry title" },
          content: { type: "string", description: "KB entry content" },
          category: { type: "string", description: "Category (default: agent_custom)" },
          tags: { type: "array", items: { type: "string" }, description: "Tags for retrieval" },
        },
        required: ["title", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_kb_audit",
      description: "Esegue un audit della Knowledge Base verificando struttura, coerenza e allineamento strategico. Usa questo tool quando l'utente chiede di verificare, analizzare o ottimizzare la KB.",
      parameters: {
        type: "object",
        properties: {
          audit_level: {
            type: "string",
            enum: ["structural", "coherence", "strategic", "all"],
            description: "Livello di audit: structural (tag/categorie), coherence (contraddizioni), strategic (allineamento obiettivo), all (tutti)",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

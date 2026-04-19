// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL DEFINITIONS (same as ai-assistant)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ALL_TOOLS: Record<string, unknown> = {
  search_partners: {
    type: "function",
    function: {
      name: "search_partners",
      description: "Search and filter partners. Supports country, city, name, rating, email/phone/profile presence, office type, favorites, services.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" }, city: { type: "string" }, search_name: { type: "string" },
          has_email: { type: "boolean" }, has_phone: { type: "boolean" }, has_profile: { type: "boolean" },
          min_rating: { type: "number" }, office_type: { type: "string", enum: ["head_office", "branch"] },
          is_favorite: { type: "boolean" }, service: { type: "string" }, network_name: { type: "string" },
          sort_by: { type: "string", enum: ["rating", "name", "recent"] },
          limit: { type: "number" }, count_only: { type: "boolean" },
        },
      },
    },
  },
  get_partner_detail: {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a partner: contacts, networks, services, certifications, social links.",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" } } },
    },
  },
  get_country_overview: {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Aggregated statistics per country.",
      parameters: { type: "object", properties: { country_code: { type: "string" }, sort_by: { type: "string" }, limit: { type: "number" } } },
    },
  },
  get_directory_status: {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Directory scanning status for countries.",
      parameters: { type: "object", properties: { country_code: { type: "string" } } },
    },
  },
  list_jobs: {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List download jobs with status and progress.",
      parameters: { type: "object", properties: { status: { type: "string" }, country_code: { type: "string" }, limit: { type: "number" } } },
    },
  },
  get_global_summary: {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database.",
      parameters: { type: "object", properties: {} },
    },
  },
  check_blacklist: {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies.",
      parameters: { type: "object", properties: { company_name: { type: "string" }, country: { type: "string" } } },
    },
  },
  list_reminders: {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List reminders.",
      parameters: { type: "object", properties: { status: { type: "string" }, priority: { type: "string" }, partner_name: { type: "string" } } },
    },
  },
  get_partners_without_contacts: {
    type: "function",
    function: {
      name: "get_partners_without_contacts",
      description: "List partners with no contacts.",
      parameters: { type: "object", properties: { country_code: { type: "string" }, limit: { type: "number" } } },
    },
  },
  // create_download_job RIMOSSO: i dati WCA arrivano via sync esterno (doctrine/data-availability).
  download_single_partner: {
    type: "function",
    function: {
      name: "download_single_partner",
      description: "Recupera/aggiorna profilo di UN SINGOLO partner. Uso eccezionale (<1% dei record con profile_description vuoto). MAI bulk.",
      parameters: {
        type: "object",
        properties: { company_name: { type: "string" }, city: { type: "string" }, country_code: { type: "string" }, wca_id: { type: "number" } },
        required: ["company_name"],
      },
    },
  },
  save_memory: {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory to persistent storage.",
      parameters: {
        type: "object",
        properties: { content: { type: "string" }, memory_type: { type: "string" }, tags: { type: "array", items: { type: "string" } }, importance: { type: "number" } },
        required: ["content", "memory_type", "tags"],
      },
    },
  },
  search_memory: {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search persistent memory.",
      parameters: { type: "object", properties: { tags: { type: "array", items: { type: "string" } }, search_text: { type: "string" }, limit: { type: "number" } } },
    },
  },
  update_partner: {
    type: "function",
    function: {
      name: "update_partner",
      description: "Update partner fields (favorite, lead_status, rating, alias).",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, company_name: { type: "string" }, is_favorite: { type: "boolean" }, lead_status: { type: "string" }, rating: { type: "number" }, company_alias: { type: "string" } },
      },
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
  update_lead_status: {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update lead status of contacts.",
      parameters: {
        type: "object",
        properties: { contact_ids: { type: "array", items: { type: "string" } }, company_name: { type: "string" }, country: { type: "string" }, status: { type: "string" } },
        required: ["status"],
      },
    },
  },
  bulk_update_partners: {
    type: "function",
    function: {
      name: "bulk_update_partners",
      description: "Update multiple partners at once.",
      parameters: {
        type: "object",
        properties: { country_code: { type: "string" }, partner_ids: { type: "array", items: { type: "string" } }, is_favorite: { type: "boolean" }, lead_status: { type: "string" } },
      },
    },
  },
  check_job_status: {
    type: "function",
    function: {
      name: "check_job_status",
      description: "Check download job status.",
      parameters: { type: "object", properties: { job_id: { type: "string" }, include_email_queue: { type: "boolean" } } },
    },
  },
  search_contacts: {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search imported contacts (CRM).",
      parameters: {
        type: "object",
        properties: { search_name: { type: "string" }, company_name: { type: "string" }, country: { type: "string" }, email: { type: "string" }, origin: { type: "string" }, lead_status: { type: "string" }, has_email: { type: "boolean" }, limit: { type: "number" }, count_only: { type: "boolean" } },
      },
    },
  },
  get_contact_detail: {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details of an imported contact.",
      parameters: { type: "object", properties: { contact_id: { type: "string" }, contact_name: { type: "string" } } },
    },
  },
  search_prospects: {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Search Italian prospects.",
      parameters: {
        type: "object",
        properties: { company_name: { type: "string" }, city: { type: "string" }, province: { type: "string" }, codice_ateco: { type: "string" }, min_fatturato: { type: "number" }, lead_status: { type: "string" }, limit: { type: "number" }, count_only: { type: "boolean" } },
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
  deep_search_partner: {
    type: "function",
    function: {
      name: "deep_search_partner",
      description: "Deep Search a partner (logo, social, web info).",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" }, force: { type: "boolean" } } },
    },
  },
  deep_search_contact: {
    type: "function",
    function: {
      name: "deep_search_contact",
      description: "Deep Search a contact (LinkedIn, social).",
      parameters: { type: "object", properties: { contact_id: { type: "string" }, contact_name: { type: "string" } } },
    },
  },
  enrich_partner_website: {
    type: "function",
    function: {
      name: "enrich_partner_website",
      description: "Scrape and analyze a partner's website.",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" } } },
    },
  },
  scan_directory: {
    type: "function",
    function: {
      name: "scan_directory",
      description: "Scan WCA directory for a country or search.",
      parameters: {
        type: "object",
        properties: { country_code: { type: "string" }, search_by: { type: "string" }, company_name: { type: "string" }, city: { type: "string" }, member_id: { type: "number" } },
      },
    },
  },
  generate_aliases: {
    type: "function",
    function: {
      name: "generate_aliases",
      description: "Generate aliases for partner companies or contacts.",
      parameters: {
        type: "object",
        properties: { partner_ids: { type: "array", items: { type: "string" } }, country_code: { type: "string" }, type: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  manage_partner_contact: {
    type: "function",
    function: {
      name: "manage_partner_contact",
      description: "Add, update, or delete a contact person for a partner.",
      parameters: {
        type: "object",
        properties: { action: { type: "string", enum: ["add", "update", "delete"] }, contact_id: { type: "string" }, partner_id: { type: "string" }, company_name: { type: "string" }, name: { type: "string" }, title: { type: "string" }, email: { type: "string" }, direct_phone: { type: "string" }, mobile: { type: "string" }, is_primary: { type: "boolean" } },
        required: ["action"],
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
  search_business_cards: {
    type: "function",
    function: {
      name: "search_business_cards",
      description: "Search business cards.",
      parameters: { type: "object", properties: { event_name: { type: "string" }, company_name: { type: "string" }, contact_name: { type: "string" }, match_status: { type: "string" }, limit: { type: "number" } } },
    },
  },
  execute_ui_action: {
    type: "function",
    function: {
      name: "execute_ui_action",
      description: "Execute a UI action: navigate to a page, show a toast notification, or apply filters.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["navigate", "toast", "filter"], description: "Type of UI action" },
          target: { type: "string", description: "For navigate: route path. For toast: message text. For filter: filter expression." },
          params: { type: "object", description: "Additional parameters" },
        },
        required: ["action", "target"],
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
  get_operations_dashboard: {
    type: "function",
    function: {
      name: "get_operations_dashboard",
      description: "Get a complete real-time overview of all system operations.",
      parameters: { type: "object", properties: {} },
    },
  },
  create_agent_task: {
    type: "function",
    function: {
      name: "create_agent_task",
      description: "Create a task for a subordinate agent.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string" }, agent_role: { type: "string" },
          task_type: { type: "string" }, description: { type: "string" },
          target_filters: { type: "object" },
        },
        required: ["description", "task_type"],
      },
    },
  },
  list_agent_tasks: {
    type: "function",
    function: {
      name: "list_agent_tasks",
      description: "List tasks across all agents.",
      parameters: { type: "object", properties: { status: { type: "string" }, agent_name: { type: "string" }, limit: { type: "number" } } },
    },
  },
  get_team_status: {
    type: "function",
    function: {
      name: "get_team_status",
      description: "Get team overview: all agents with stats, active tasks, last activity.",
      parameters: { type: "object", properties: {} },
    },
  },
  update_agent_prompt: {
    type: "function",
    function: {
      name: "update_agent_prompt",
      description: "Update the system prompt of a subordinate agent.",
      parameters: {
        type: "object",
        properties: { agent_name: { type: "string" }, prompt_addition: { type: "string" }, replace_prompt: { type: "string" } },
        required: ["agent_name"],
      },
    },
  },
  add_agent_kb_entry: {
    type: "function",
    function: {
      name: "add_agent_kb_entry",
      description: "Add a knowledge base entry to a subordinate agent.",
      parameters: {
        type: "object",
        properties: { agent_name: { type: "string" }, title: { type: "string" }, content: { type: "string" } },
        required: ["agent_name", "title", "content"],
      },
    },
  },
  create_work_plan: {
    type: "function",
    function: {
      name: "create_work_plan",
      description: "Create a strategic work plan with multi-step objectives.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" }, description: { type: "string" },
          steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } } } },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "steps"],
      },
    },
  },
  list_work_plans: {
    type: "function",
    function: {
      name: "list_work_plans",
      description: "List work plans.",
      parameters: { type: "object", properties: { status: { type: "string", enum: ["draft", "active", "completed", "archived"] }, tag: { type: "string" }, limit: { type: "number" } } },
    },
  },
  update_work_plan: {
    type: "function",
    function: {
      name: "update_work_plan",
      description: "Update a work plan: advance step, change status, add notes.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string" }, status: { type: "string", enum: ["draft", "active", "completed", "archived"] },
          advance_step: { type: "boolean" }, metadata_note: { type: "string" },
        },
        required: ["plan_id"],
      },
    },
  },
  manage_workspace_preset: {
    type: "function",
    function: {
      name: "manage_workspace_preset",
      description: "Create or update a workspace preset with commercial goals, base proposals, and email content templates.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "list", "delete"] },
          preset_id: { type: "string" }, name: { type: "string" },
          goal: { type: "string" }, base_proposal: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  get_system_analytics: {
    type: "function",
    function: {
      name: "get_system_analytics",
      description: "Get comprehensive system analytics.",
      parameters: { type: "object", properties: { focus: { type: "string" } } },
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
  update_message_status: {
    type: "function",
    function: {
      name: "update_message_status",
      description: "Mark a channel_message as read/processed.",
      parameters: { type: "object", properties: { message_id: { type: "string" } }, required: ["message_id"] },
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
  assign_contacts_to_agent: {
    type: "function",
    function: {
      name: "assign_contacts_to_agent",
      description: "Assign a batch of contacts to an agent.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string" }, country_code: { type: "string" },
          lead_status: { type: "string" }, source_type: { type: "string", enum: ["partner", "contact", "prospect"] },
          limit: { type: "number" },
        },
        required: ["agent_name"],
      },
    },
  },
  create_campaign: {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Create a structured outreach campaign with optional A/B test.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" }, objective: { type: "string" },
          country_codes: { type: "array", items: { type: "string" } },
          contact_type: { type: "string", enum: ["wca", "crm", "ex_client", "all"] },
          agent_names: { type: "array", items: { type: "string" } },
          ab_test: { type: "object", properties: {
            enabled: { type: "boolean" },
            variants: { type: "array", items: { type: "object", properties: {
              agent_name: { type: "string" }, tone: { type: "string" }, percentage: { type: "number" },
            }}}
          }},
          max_contacts: { type: "number" },
        },
        required: ["name", "objective"],
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
  suggest_next_contacts: {
    type: "function",
    function: {
      name: "suggest_next_contacts",
      description: "Suggest never-contacted partners for outreach.",
      parameters: { type: "object", properties: { focus: { type: "string" }, channel: { type: "string" }, batch_size: { type: "number" } } },
    },
  },
  detect_language: {
    type: "function",
    function: {
      name: "detect_language",
      description: "Detect language for a country code.",
      parameters: { type: "object", properties: { country_code: { type: "string" } }, required: ["country_code"] },
    },
  },
  get_pending_actions: {
    type: "function",
    function: {
      name: "get_pending_actions",
      description: "Get AI pending actions for review.",
      parameters: { type: "object", properties: { status: { type: "string" }, action_type: { type: "string" }, limit: { type: "number" } } },
    },
  },
  approve_ai_action: {
    type: "function",
    function: {
      name: "approve_ai_action",
      description: "Approve a pending AI action.",
      parameters: { type: "object", properties: { action_id: { type: "string" } }, required: ["action_id"] },
    },
  },
  reject_ai_action: {
    type: "function",
    function: {
      name: "reject_ai_action",
      description: "Reject a pending AI action.",
      parameters: { type: "object", properties: { action_id: { type: "string" }, reason: { type: "string" } }, required: ["action_id"] },
    },
  },
};

/**
 * platformToolDefs.ts - Tool definitions in OpenAI format
 * Single source of truth for all available platform tools
 */

export const PLATFORM_TOOLS = [
  // ── Partners ──
  {
    type: "function",
    function: {
      name: "search_partners",
      description:
        "Search and filter partners by country, city, name, rating, email/phone/profile presence, office type, favorites, services.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          country_codes: { type: "array", items: { type: "string" } },
          city: { type: "string" },
          search_name: { type: "string" },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          has_profile: { type: "boolean" },
          has_alias: { type: "boolean" },
          min_rating: { type: "number" },
          office_type: { type: "string", enum: ["head_office", "branch"] },
          is_favorite: { type: "boolean" },
          service: { type: "string" },
          sort_by: { type: "string", enum: ["rating", "name", "recent", "interaction_count", "last_interaction_at"] },
          lead_status: { type: "string" },
          lead_statuses: { type: "array", items: { type: "string" } },
          member_expiring_within_days: { type: "number" },
          limit: { type: "number" },
          count_only: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a partner: contacts, networks, services, certifications.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Aggregated statistics per country.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          sort_by: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_partner",
      description: "Update partner fields (favorite, lead_status, rating, alias).",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
          is_favorite: { type: "boolean" },
          lead_status: { type: "string" },
          rating: { type: "number" },
          company_alias: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_partner_note",
      description: "Add a note/interaction to a partner.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
          subject: { type: "string" },
          notes: { type: "string" },
          interaction_type: { type: "string" },
        },
        required: ["subject"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update_partners",
      description: "Update multiple partners at once.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          partner_ids: { type: "array", items: { type: "string" } },
          is_favorite: { type: "boolean" },
          lead_status: { type: "string" },
        },
      },
    },
  },

  // ── Contacts (CRM) ──
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search imported contacts (CRM).",
      parameters: {
        type: "object",
        properties: {
          search_name: { type: "string" },
          company_name: { type: "string" },
          country: { type: "string" },
          city: { type: "string" },
          email: { type: "string" },
          origin: { type: "string", description: "Filtra per origine specifica (csv_import, manual, sherlock, ...)" },
          only_manual: { type: "boolean", description: "Mostra solo contatti inseriti manualmente (origin=manual)." },
          lead_status: { type: "string" },
          lead_statuses: { type: "array", items: { type: "string" } },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          has_deep_search: { type: "boolean" },
          has_alias: { type: "boolean" },
          holding_pattern: { type: "string", enum: ["in", "out"] },
          import_log_id: { type: "string" },
          date_from: { type: "string" },
          date_to: { type: "string" },
          sort: { type: "string", enum: ["recent", "name_asc", "name_desc", "company_asc", "company_desc", "score_desc", "last_interaction"] },
          page: { type: "number" },
          limit: { type: "number" },
          count_only: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details of an imported contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          contact_name: { type: "string" },
          email: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update lead status of contacts.",
      parameters: {
        type: "object",
        properties: {
          contact_ids: { type: "array", items: { type: "string" } },
          company_name: { type: "string" },
          country: { type: "string" },
          status: { type: "string" },
        },
        required: ["status"],
      },
    },
  },

  // ── Prospects ──
  {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Search Italian prospects.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          city: { type: "string" },
          province: { type: "string" },
          codice_ateco: { type: "string" },
          min_fatturato: { type: "number" },
          lead_status: { type: "string" },
          limit: { type: "number" },
          count_only: { type: "boolean" },
        },
      },
    },
  },

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

  // ── System ──
  {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          country: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_operations_dashboard",
      description: "Get a complete real-time overview of all system operations.",
      parameters: { type: "object", properties: {} },
    },
  },

  // ── Contacts Management ──
  {
    type: "function",
    function: {
      name: "manage_partner_contact",
      description: "Add, update, or delete a contact person for a partner.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add", "update", "delete"],
          },
          contact_id: { type: "string" },
          partner_id: { type: "string" },
          company_name: { type: "string" },
          name: { type: "string" },
          title: { type: "string" },
          email: { type: "string" },
          direct_phone: { type: "string" },
          mobile: { type: "string" },
          is_primary: { type: "boolean" },
        },
        required: ["action"],
      },
    },
  },

  // ── UI Actions ──
  {
    type: "function",
    function: {
      name: "execute_ui_action",
      description: "Execute a UI action: navigate to a page, show a toast notification, or apply filters.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["navigate", "toast", "filter"] },
          target: { type: "string" },
          params: { type: "object" },
        },
        required: ["action", "target"],
      },
    },
  },

  // ── Agent Management ──
  {
    type: "function",
    function: {
      name: "create_agent_task",
      description: "Create a task for a subordinate agent.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string" },
          agent_role: { type: "string" },
          task_type: { type: "string" },
          description: { type: "string" },
          target_filters: { type: "object" },
        },
        required: ["description", "task_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_agent_tasks",
      description: "List tasks across all agents.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          agent_name: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_status",
      description: "Get team overview: all agents with stats, active tasks, last activity.",
      parameters: { type: "object", properties: {} },
    },
  },

  // ── Work Plans ──
  {
    type: "function",
    function: {
      name: "create_work_plan",
      description: "Create a strategic work plan with multi-step objectives.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
              },
            },
          },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_work_plans",
      description: "List work plans.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "active", "completed", "archived"] },
          tag: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },

  // ── Aliases ──
  {
    type: "function",
    function: {
      name: "generate_aliases",
      description: "Generate aliases for partner companies or contacts.",
      parameters: {
        type: "object",
        properties: {
          partner_ids: { type: "array", items: { type: "string" } },
          country_code: { type: "string" },
          type: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },

  // ── Delete ──
  {
    type: "function",
    function: {
      name: "delete_records",
      description: "Delete records from the system.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          ids: { type: "array", items: { type: "string" } },
        },
        required: ["table", "ids"],
      },
    },
  },

  // ── Detail handlers nuovi (allineamento UI) ──
  { type: "function", function: { name: "get_business_card_detail", description: "Dettaglio completo di un biglietto da visita (OCR full + partner/contact matchato + email correlate).", parameters: { type: "object", properties: { card_id: { type: "string" }, email: { type: "string" }, contact_name: { type: "string" } } } } },
  { type: "function", function: { name: "get_prospect_detail", description: "Dettaglio completo di un prospect IT (anagrafica + prospect_contacts + deals).", parameters: { type: "object", properties: { prospect_id: { type: "string" }, company_name: { type: "string" } } } } },
  { type: "function", function: { name: "search_partner_contacts", description: "Cerca direttamente nei contatti diretti dei partner WCA.", parameters: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, partner_id: { type: "string" }, is_primary: { type: "boolean" }, limit: { type: "number" } } } } },

  // ── Domini transazionali ──
  { type: "function", function: { name: "list_deals", description: "Lista deals (opportunità commerciali) con filtri stage/partner/contact.", parameters: { type: "object", properties: { stage: { type: "string" }, stages: { type: "array", items: { type: "string" } }, partner_id: { type: "string" }, contact_id: { type: "string" }, min_amount: { type: "number" }, closing_within_days: { type: "number" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_pipeline_view", description: "Vista kanban aggregata: count e total_value per stage.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_outreach_queue", description: "Lista voci nella coda di outreach (pending, sent, failed).", parameters: { type: "object", properties: { status: { type: "string" }, statuses: { type: "array", items: { type: "string" } }, channel: { type: "string" }, partner_id: { type: "string" }, contact_id: { type: "string" }, has_reply: { type: "boolean" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "list_calendar_events", description: "Lista eventi del calendario (meeting, call, follow-up).", parameters: { type: "object", properties: { event_type: { type: "string" }, status: { type: "string" }, partner_id: { type: "string" }, contact_id: { type: "string" }, deal_id: { type: "string" }, from_date: { type: "string" }, to_date: { type: "string" }, upcoming: { type: "boolean" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "list_notifications", description: "Lista notifiche dell'utente corrente.", parameters: { type: "object", properties: { unread_only: { type: "boolean" }, type: { type: "string" }, entity_type: { type: "string" }, entity_id: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "list_agent_tasks_status", description: "Lista task degli agent AI con status di esecuzione.", parameters: { type: "object", properties: { status: { type: "string" }, agent_id: { type: "string" }, task_type: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "search_kb", description: "Cerca nella Knowledge Base interna (full text su title+content).", parameters: { type: "object", properties: { query: { type: "string" }, category: { type: "string" }, chapter: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_lead_score_breakdown", description: "Scomposizione del lead_score per un contatto (0-100).", parameters: { type: "object", properties: { contact_id: { type: "string" } }, required: ["contact_id"] } } },
  { type: "function", function: { name: "check_blacklist_email", description: "Controlla se una specifica email o dominio è in blacklist.", parameters: { type: "object", properties: { email: { type: "string" } }, required: ["email"] } } },
  { type: "function", function: { name: "list_email_send_log", description: "Storico invii email (campagne e dirette).", parameters: { type: "object", properties: { recipient_email: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_holding_pattern_list", description: "Lista contatti in holding pattern (interaction_count = 0).", parameters: { type: "object", properties: { country: { type: "string" }, lead_status: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_global_dashboard", description: "Dashboard omnicomprensiva: totals, pipeline, queue, notifiche, calendar, business cards.", parameters: { type: "object", properties: {} } } },
];

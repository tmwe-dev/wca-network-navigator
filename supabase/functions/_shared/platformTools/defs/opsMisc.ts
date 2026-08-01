export const TOOLS_OPS_MISC = [
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

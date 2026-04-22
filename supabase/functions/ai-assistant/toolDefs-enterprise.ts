/**
 * toolDefs-enterprise.ts — Enterprise & workflow tool definitions
 * Categories: Workflows, Playbooks, Enrichment, Intelligence, Actions
 */

import type { ToolDefinition } from "./toolDefinitions.ts";

export const ENTERPRISE_TOOLS: ToolDefinition[] = [
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
];

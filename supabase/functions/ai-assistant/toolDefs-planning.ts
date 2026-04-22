/**
 * toolDefs-planning.ts — Planning & memory tool definitions
 * Categories: Memory, Work Plans, Business Cards, KB
 */

import type { ToolDefinition } from "./toolDefinitions.ts";

export const PLANNING_TOOLS: ToolDefinition[] = [
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

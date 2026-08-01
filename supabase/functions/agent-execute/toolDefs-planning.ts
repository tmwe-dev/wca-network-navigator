// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PLANNING, CAMPAIGNS & WORKSPACE TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PLANNING_TOOLS: Record<string, unknown> = {
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
  suggest_next_contacts: {
    type: "function",
    function: {
      name: "suggest_next_contacts",
      description: "Suggest never-contacted partners for outreach.",
      parameters: { type: "object", properties: { focus: { type: "string" }, channel: { type: "string" }, batch_size: { type: "number" } } },
    },
  },
};

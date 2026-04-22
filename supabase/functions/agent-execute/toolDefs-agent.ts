// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AGENT MANAGEMENT & TEAM TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AGENT_TOOLS: Record<string, unknown> = {
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
};

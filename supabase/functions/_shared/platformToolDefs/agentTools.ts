/**
 * agentTools.ts — Agent management and delegation tool definitions.
 */

export const AGENT_TOOLS = [
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
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

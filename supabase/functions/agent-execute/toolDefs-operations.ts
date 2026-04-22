// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OPERATIONS, ANALYTICS & UI TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const OPERATIONS_TOOLS: Record<string, unknown> = {
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
  get_operations_dashboard: {
    type: "function",
    function: {
      name: "get_operations_dashboard",
      description: "Get a complete real-time overview of all system operations.",
      parameters: { type: "object", properties: {} },
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
  check_job_status: {
    type: "function",
    function: {
      name: "check_job_status",
      description: "Check download job status.",
      parameters: { type: "object", properties: { job_id: { type: "string" }, include_email_queue: { type: "boolean" } } },
    },
  },
};

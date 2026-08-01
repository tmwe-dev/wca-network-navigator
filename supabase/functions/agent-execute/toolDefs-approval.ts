// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// APPROVAL FLOW & DECISION ENGINE TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const APPROVAL_TOOLS: Record<string, unknown> = {
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
  evaluate_partner: {
    type: "function",
    function: {
      name: "evaluate_partner",
      description: "Evaluate a partner using the Decision Engine. Returns partner state, enrichment score, and recommended next actions with autonomy levels. Use this to understand what the system suggests doing next for a partner.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "Partner UUID" },
          company_name: { type: "string", description: "Company name (alternative to partner_id)" },
        },
      },
    },
  },
  execute_decision: {
    type: "function",
    function: {
      name: "execute_decision",
      description: "Run the Decision Engine for a partner AND process the recommended actions through the approval flow. Actions are queued based on their autonomy level: 'suggest' = shown only, 'prepare' = queued for approval, 'execute' = auto-approved with 30s undo window, 'autopilot' = immediate execution.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "Partner UUID" },
          company_name: { type: "string", description: "Company name (alternative to partner_id)" },
          autonomy: { type: "string", enum: ["suggest", "prepare", "execute", "autopilot"], description: "Override autonomy level (optional, defaults to user preference)" },
        },
      },
    },
  },
  undo_ai_action: {
    type: "function",
    function: {
      name: "undo_ai_action",
      description: "Undo an approved action within its undo window (30 seconds for 'execute' level actions).",
      parameters: { type: "object", properties: { action_id: { type: "string" } }, required: ["action_id"] },
    },
  },
  get_approval_dashboard: {
    type: "function",
    function: {
      name: "get_approval_dashboard",
      description: "Get a summary of the approval queue: pending, approved, executing counts, plus today's completed/failed/rejected/undone counts.",
      parameters: { type: "object", properties: {} },
    },
  },
};

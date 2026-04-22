/**
 * workPlanTools.ts — Work plan and strategic planning tool definitions.
 */

export const WORK_PLAN_TOOLS = [
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
];

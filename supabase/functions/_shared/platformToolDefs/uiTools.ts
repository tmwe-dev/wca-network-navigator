/**
 * uiTools.ts — UI action tool definitions.
 */

export const UI_TOOLS = [
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
];

/**
 * deleteTools.ts — Data deletion and cleanup tool definitions.
 */

export const DELETE_TOOLS = [
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
];

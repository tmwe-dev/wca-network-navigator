/**
 * memoryTools.ts — Memory and persistence tool definitions.
 */

export const MEMORY_TOOLS = [
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory to persistent storage.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          memory_type: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          importance: { type: "number" },
        },
        required: ["content", "memory_type", "tags"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search persistent memory.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" } },
          search_text: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
];

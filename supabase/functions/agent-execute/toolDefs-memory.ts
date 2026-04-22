// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEMORY & KNOWLEDGE TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MEMORY_TOOLS: Record<string, unknown> = {
  save_memory: {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory to persistent storage.",
      parameters: {
        type: "object",
        properties: { content: { type: "string" }, memory_type: { type: "string" }, tags: { type: "array", items: { type: "string" } }, importance: { type: "number" } },
        required: ["content", "memory_type", "tags"],
      },
    },
  },
  search_memory: {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search persistent memory.",
      parameters: { type: "object", properties: { tags: { type: "array", items: { type: "string" } }, search_text: { type: "string" }, limit: { type: "number" } } },
    },
  },
};

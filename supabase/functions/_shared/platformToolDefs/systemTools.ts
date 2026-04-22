/**
 * systemTools.ts — System utilities and admin tool definitions.
 */

export const SYSTEM_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          country: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_operations_dashboard",
      description: "Get a complete real-time overview of all system operations.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

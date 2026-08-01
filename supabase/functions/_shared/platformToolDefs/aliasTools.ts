/**
 * aliasTools.ts — Alias generation tool definitions.
 */

export const ALIAS_TOOLS = [
  {
    type: "function",
    function: {
      name: "generate_aliases",
      description: "Generate aliases for partner companies or contacts.",
      parameters: {
        type: "object",
        properties: {
          partner_ids: { type: "array", items: { type: "string" } },
          country_code: { type: "string" },
          type: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
];

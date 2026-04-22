/**
 * businessCardTools.ts — Business card management tool definitions.
 */

export const BUSINESS_CARD_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_business_cards",
      description: "Search business cards.",
      parameters: {
        type: "object",
        properties: {
          event_name: { type: "string" },
          company_name: { type: "string" },
          contact_name: { type: "string" },
          match_status: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
];

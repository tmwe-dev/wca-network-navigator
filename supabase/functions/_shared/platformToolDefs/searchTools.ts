/**
 * searchTools.ts — Directory scanning and deep search tool definitions.
 */

export const SEARCH_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Directory scanning status for countries.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_search_partner",
      description: "Deep Search a partner (logo, social, web info).",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
          force: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_search_contact",
      description: "Deep Search a contact (LinkedIn, social).",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          contact_name: { type: "string" },
        },
      },
    },
  },
];

/**
 * crmTools.ts — CRM/Contacts and Prospects tool definitions.
 */

export const CRM_TOOLS = [
  // ── Contacts (CRM) ──
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search imported contacts (CRM).",
      parameters: {
        type: "object",
        properties: {
          search_name: { type: "string" },
          company_name: { type: "string" },
          country: { type: "string" },
          email: { type: "string" },
          origin: { type: "string" },
          lead_status: { type: "string" },
          has_email: { type: "boolean" },
          limit: { type: "number" },
          count_only: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details of an imported contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          contact_name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update lead status of contacts.",
      parameters: {
        type: "object",
        properties: {
          contact_ids: { type: "array", items: { type: "string" } },
          company_name: { type: "string" },
          country: { type: "string" },
          status: { type: "string" },
        },
        required: ["status"],
      },
    },
  },

  // ── Prospects ──
  {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Search Italian prospects.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          city: { type: "string" },
          province: { type: "string" },
          codice_ateco: { type: "string" },
          min_fatturato: { type: "number" },
          lead_status: { type: "string" },
          limit: { type: "number" },
          count_only: { type: "boolean" },
        },
      },
    },
  },
];

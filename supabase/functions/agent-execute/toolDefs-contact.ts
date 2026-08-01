// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTACT & PROSPECT TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CONTACT_TOOLS: Record<string, unknown> = {
  search_contacts: {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search imported contacts (CRM).",
      parameters: {
        type: "object",
        properties: { search_name: { type: "string" }, company_name: { type: "string" }, country: { type: "string" }, email: { type: "string" }, origin: { type: "string" }, lead_status: { type: "string" }, has_email: { type: "boolean" }, limit: { type: "number" }, count_only: { type: "boolean" } },
      },
    },
  },
  get_contact_detail: {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details of an imported contact.",
      parameters: { type: "object", properties: { contact_id: { type: "string" }, contact_name: { type: "string" } } },
    },
  },
  search_prospects: {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Search Italian prospects.",
      parameters: {
        type: "object",
        properties: { company_name: { type: "string" }, city: { type: "string" }, province: { type: "string" }, codice_ateco: { type: "string" }, min_fatturato: { type: "number" }, lead_status: { type: "string" }, limit: { type: "number" }, count_only: { type: "boolean" } },
      },
    },
  },
  manage_partner_contact: {
    type: "function",
    function: {
      name: "manage_partner_contact",
      description: "Add, update, or delete a contact person for a partner.",
      parameters: {
        type: "object",
        properties: { action: { type: "string", enum: ["add", "update", "delete"] }, contact_id: { type: "string" }, partner_id: { type: "string" }, company_name: { type: "string" }, name: { type: "string" }, title: { type: "string" }, email: { type: "string" }, direct_phone: { type: "string" }, mobile: { type: "string" }, is_primary: { type: "boolean" } },
        required: ["action"],
      },
    },
  },
  update_lead_status: {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update lead status of contacts.",
      parameters: {
        type: "object",
        properties: { contact_ids: { type: "array", items: { type: "string" } }, company_name: { type: "string" }, country: { type: "string" }, status: { type: "string" } },
        required: ["status"],
      },
    },
  },
};

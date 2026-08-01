/**
 * partnersTools.ts — Partner-related tool definitions.
 */

export const PARTNERS_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_partners",
      description:
        "Search and filter partners by country, city, name, rating, email/phone/profile presence, office type, favorites, services.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          city: { type: "string" },
          search_name: { type: "string" },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          has_profile: { type: "boolean" },
          min_rating: { type: "number" },
          office_type: { type: "string", enum: ["head_office", "branch"] },
          is_favorite: { type: "boolean" },
          service: { type: "string" },
          sort_by: { type: "string", enum: ["rating", "name", "recent"] },
          limit: { type: "number" },
          count_only: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a partner: contacts, networks, services, certifications.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Aggregated statistics per country.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          sort_by: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_partner",
      description: "Update partner fields (favorite, lead_status, rating, alias).",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
          is_favorite: { type: "boolean" },
          lead_status: { type: "string" },
          rating: { type: "number" },
          company_alias: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_partner_note",
      description: "Add a note/interaction to a partner.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string" },
          company_name: { type: "string" },
          subject: { type: "string" },
          notes: { type: "string" },
          interaction_type: { type: "string" },
        },
        required: ["subject"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update_partners",
      description: "Update multiple partners at once.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          partner_ids: { type: "array", items: { type: "string" } },
          is_favorite: { type: "boolean" },
          lead_status: { type: "string" },
        },
      },
    },
  },
];

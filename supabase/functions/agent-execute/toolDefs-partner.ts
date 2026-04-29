// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARTNER & LOCAL DATA TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PARTNER_TOOLS: Record<string, unknown> = {
  search_partners: {
    type: "function",
    function: {
      name: "search_partners",
      description: "Search and filter partners. Supports country, city, name, rating, email/phone/profile presence, office type, favorites, services.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" }, city: { type: "string" }, search_name: { type: "string" },
          has_email: { type: "boolean" }, has_phone: { type: "boolean" }, has_profile: { type: "boolean" },
          min_rating: { type: "number" }, office_type: { type: "string", enum: ["head_office", "branch"] },
          is_favorite: { type: "boolean" }, service: { type: "string" }, network_name: { type: "string" },
          sort_by: { type: "string", enum: ["rating", "name", "recent"] },
          limit: { type: "number" }, count_only: { type: "boolean" },
        },
      },
    },
  },
  get_partner_detail: {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a partner: contacts, networks, services, certifications, social links.",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" } } },
    },
  },
  get_country_overview: {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Aggregated statistics per country.",
      parameters: { type: "object", properties: { country_code: { type: "string" }, sort_by: { type: "string" }, limit: { type: "number" } } },
    },
  },
  get_directory_status: {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Local data coverage status for countries. Uses already synchronized internal partner/profile/contact data only; it never scans or downloads WCA directories.",
      parameters: { type: "object", properties: { country_code: { type: "string" } } },
    },
  },
  list_jobs: {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List download jobs with status and progress.",
      parameters: { type: "object", properties: { status: { type: "string" }, country_code: { type: "string" }, limit: { type: "number" } } },
    },
  },
  get_global_summary: {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database.",
      parameters: { type: "object", properties: {} },
    },
  },
  check_blacklist: {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies.",
      parameters: { type: "object", properties: { company_name: { type: "string" }, country: { type: "string" } } },
    },
  },
  update_partner: {
    type: "function",
    function: {
      name: "update_partner",
      description: "Update partner fields (favorite, lead_status, rating, alias).",
      parameters: {
        type: "object",
        properties: { partner_id: { type: "string" }, company_name: { type: "string" }, is_favorite: { type: "boolean" }, lead_status: { type: "string" }, rating: { type: "number" }, company_alias: { type: "string" } },
      },
    },
  },
  bulk_update_partners: {
    type: "function",
    function: {
      name: "bulk_update_partners",
      description: "Update multiple partners at once.",
      parameters: {
        type: "object",
        properties: { country_code: { type: "string" }, partner_ids: { type: "array", items: { type: "string" } }, is_favorite: { type: "boolean" }, lead_status: { type: "string" } },
      },
    },
  },
  get_partners_without_contacts: {
    type: "function",
    function: {
      name: "get_partners_without_contacts",
      description: "List partners with no contacts.",
      parameters: { type: "object", properties: { country_code: { type: "string" }, limit: { type: "number" } } },
    },
  },
};

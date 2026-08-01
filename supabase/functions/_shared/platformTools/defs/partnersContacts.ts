export const TOOLS_PARTNERS_CONTACTS = [
  // ── Partners ──
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
          country_codes: { type: "array", items: { type: "string" } },
          city: { type: "string" },
          search_name: { type: "string" },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          has_profile: { type: "boolean" },
          has_alias: { type: "boolean" },
          min_rating: { type: "number" },
          office_type: { type: "string", enum: ["head_office", "branch"] },
          is_favorite: { type: "boolean" },
          service: { type: "string" },
          sort_by: { type: "string", enum: ["rating", "name", "recent", "interaction_count", "last_interaction_at"] },
          lead_status: { type: "string" },
          lead_statuses: { type: "array", items: { type: "string" } },
          member_expiring_within_days: { type: "number" },
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
          city: { type: "string" },
          email: { type: "string" },
          origin: { type: "string", description: "Filtra per origine specifica (csv_import, manual, sherlock, ...)" },
          only_manual: { type: "boolean", description: "Mostra solo contatti inseriti manualmente (origin=manual)." },
          lead_status: { type: "string" },
          lead_statuses: { type: "array", items: { type: "string" } },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          has_deep_search: { type: "boolean" },
          has_alias: { type: "boolean" },
          holding_pattern: { type: "string", enum: ["in", "out"] },
          import_log_id: { type: "string" },
          date_from: { type: "string" },
          date_to: { type: "string" },
          sort: { type: "string", enum: ["recent", "name_asc", "name_desc", "company_asc", "company_desc", "score_desc", "last_interaction"] },
          page: { type: "number" },
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
          email: { type: "string" },
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

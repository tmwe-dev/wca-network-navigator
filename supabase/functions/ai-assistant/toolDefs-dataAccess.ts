/**
 * toolDefs-dataAccess.ts — Data access & search tool definitions
 * Categories: Partners, Contacts, Prospects, Overview
 */

import type { ToolDefinition } from "./toolDefinitions.ts";

export const DATA_ACCESS_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_partners",
      description: "Search and filter partners across the database. Supports filtering by country, city, name, rating, email/phone/profile presence, office type, favorites, branches, and services. Can return full results or just a count.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "ISO 2-letter country code" },
          city: { type: "string", description: "City name (partial match)" },
          search_name: { type: "string", description: "Company name (partial match)" },
          has_email: { type: "boolean", description: "Has email address" },
          has_phone: { type: "boolean", description: "Has phone number (in partner_contacts)" },
          has_profile: { type: "boolean", description: "Has profile description (sourced from WCA sync — populated for ≥99% of records)" },
          min_rating: { type: "number", description: "Minimum rating (0-5)" },
          office_type: { type: "string", enum: ["head_office", "branch"], description: "Filter by office type" },
          is_favorite: { type: "boolean", description: "Filter favorites only" },
          has_branches: { type: "boolean", description: "Has branch offices" },
          service: { type: "string", enum: ["air_freight","ocean_fcl","ocean_lcl","road_freight","rail_freight","project_cargo","dangerous_goods","perishables","pharma","ecommerce","relocations","customs_broker","warehousing","nvocc"], description: "Filter by service category" },
          certification: { type: "string", enum: ["IATA","BASC","ISO","C-TPAT","AEO"], description: "Filter by certification" },
          network_name: { type: "string", description: "Filter by network membership name" },
          sort_by: { type: "string", enum: ["rating", "name", "recent", "seniority"], description: "Sort order. 'seniority' = longest WCA membership first (by member_since)" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
          count_only: { type: "boolean", description: "Return only the count" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_country_overview",
      description: "Get aggregated statistics per country: total partners, profiles, emails, phones.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional: specific country code" },
          sort_by: { type: "string", enum: ["total", "missing_profiles", "missing_emails"], description: "How to rank countries" },
          limit: { type: "number", description: "Max countries to return (default 30)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_directory_status",
      description: "Check data coverage status for countries: internal coverage and sync quality indicators.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Optional: specific country code" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List asynchronous jobs with their status, progress, and errors.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["running", "pending", "completed", "cancelled"] },
          country_code: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partner_detail",
      description: "Get complete details of a specific partner. ALWAYS call this when the user names a specific company (e.g. 'Transport Management', 'XYZ srl Milano'). Returns: company info, city/country, WCA ID, membership_expires, ALL contacts (partner_contacts + business_cards + imported_contacts deduplicated, with `contacts_count_total` and `contacts_breakdown`), networks with expiry, services, certifications, social links, blacklist matches. Pass partner_id if known (from search_partners) else company_name.",
      parameters: {
        type: "object",
        properties: {
          partner_id: { type: "string", description: "UUID of the partner" },
          company_name: { type: "string", description: "Company name to search (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_global_summary",
      description: "High-level summary of the entire database: total partners, countries, profiles, emails, phones, directory coverage, active jobs.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "check_blacklist",
      description: "Search the blacklist for companies flagged for payment issues.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          country: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List reminders associated with partners.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "completed"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          partner_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_partners_without_contacts",
      description: "List partners with no contact information.",
      parameters: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search imported contacts (CRM). Filter by name, company, country, email, origin, lead_status, group (import_log_id).",
      parameters: {
        type: "object",
        properties: {
          search_name: { type: "string", description: "Contact name (partial match)" },
          company_name: { type: "string", description: "Company name (partial match)" },
          country: { type: "string", description: "Country (partial match)" },
          email: { type: "string", description: "Email (partial match)" },
          origin: { type: "string", description: "Origin/source filter" },
          lead_status: { type: "string", enum: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"] },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          limit: { type: "number", description: "Max results (default 20, max 50)" },
          count_only: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_detail",
      description: "Get full details of an imported contact including interactions and enrichment data.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "UUID of the contact" },
          contact_name: { type: "string", description: "Name to search (if ID not known)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Search Italian prospects (Report Aziende). Filter by company name, city, province, codice_ateco, fatturato range, lead_status.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Company name (partial match)" },
          city: { type: "string", description: "City (partial match)" },
          province: { type: "string", description: "Province code" },
          region: { type: "string", description: "Region" },
          codice_ateco: { type: "string", description: "ATECO code (partial match)" },
          min_fatturato: { type: "number", description: "Minimum revenue" },
          max_fatturato: { type: "number", description: "Maximum revenue" },
          lead_status: { type: "string", enum: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"] },
          has_email: { type: "boolean" },
          limit: { type: "number", description: "Max results (default 20)" },
          count_only: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
];

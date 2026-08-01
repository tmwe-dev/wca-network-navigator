/**
 * Tests: Zod Schemas + Mappers
 */
import { describe, it, expect } from "vitest";
import { PartnerRowSchema } from "../../io/supabase/schemas/partner-schema";
import { ContactRowSchema } from "../../io/supabase/schemas/contact-schema";
import { AgentRowSchema } from "../../io/supabase/schemas/agent-schema";
import { mapPartnerRow } from "../../core/mappers/partner-mapper";
import { mapContactRow } from "../../core/mappers/contact-mapper";
import { isOk, isErr } from "../../core/domain/result";

const VALID_PARTNER_ROW = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  company_name: "Acme Logistics",
  wca_id: 12345,
  country_code: "IT",
  country_name: "Italy",
  city: "Milano",
  address: "Via Roma 1",
  phone: "+39123456",
  mobile: null,
  fax: null,
  emergency_phone: null,
  email: "info@acme.it",
  website: "https://acme.it",
  member_since: "2020-01-01",
  membership_expires: null,
  profile_description: null,
  office_type: null,
  partner_type: null,
  has_branches: null,
  branch_cities: null,
  is_active: true,
  is_favorite: false,
  lead_status: "new",
  logo_url: null,
  rating: null,
  rating_details: null,
  enrichment_data: null,
  enriched_at: null,
  raw_profile_html: null,
  raw_profile_markdown: null,
  ai_parsed_at: null,
  company_alias: null,
  interaction_count: 0,
  last_interaction_at: null,
  converted_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  user_id: "660e8400-e29b-41d4-a716-446655440000",
};

const VALID_CONTACT_ROW = {
  id: "770e8400-e29b-41d4-a716-446655440000",
  import_log_id: "880e8400-e29b-41d4-a716-446655440000",
  name: "John Doe",
  company_name: "Acme",
  email: "john@acme.it",
  phone: "+39123",
  mobile: null,
  position: "CEO",
  city: "Rome",
  country: "IT",
  origin: "csv",
  lead_status: "new",
  is_selected: false,
  is_transferred: false,
  wca_partner_id: null,
  wca_match_confidence: null,
  row_number: 1,
  interaction_count: 0,
  last_interaction_at: null,
  created_at: "2024-01-01T00:00:00Z",
  user_id: null,
};

describe("Zod Schemas", () => {
  it("PartnerRowSchema accepts valid row", () => {
    expect(PartnerRowSchema.safeParse(VALID_PARTNER_ROW).success).toBe(true);
  });

  it("PartnerRowSchema rejects missing company_name", () => {
    const { company_name: _company_name, ...invalid } = VALID_PARTNER_ROW;
    expect(PartnerRowSchema.safeParse(invalid).success).toBe(false);
  });

  it("ContactRowSchema accepts valid row", () => {
    expect(ContactRowSchema.safeParse(VALID_CONTACT_ROW).success).toBe(true);
  });

  it("AgentRowSchema rejects empty object", () => {
    expect(AgentRowSchema.safeParse({}).success).toBe(false);
  });
});

describe("Mappers", () => {
  it("mapPartnerRow converts valid row to domain entity", () => {
    const mapped = mapPartnerRow(VALID_PARTNER_ROW);
    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value.companyName).toBe("Acme Logistics");
      expect(mapped.value.countryCode).toBe("IT");
      expect(mapped.value.wcaId).toBe(12345);
    }
  });

  it("mapPartnerRow returns Err on invalid data", () => {
    const mapped = mapPartnerRow({ id: "not-uuid" });
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error.code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("mapContactRow converts valid row", () => {
    const mapped = mapContactRow(VALID_CONTACT_ROW);
    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value.name).toBe("John Doe");
      expect(mapped.value.leadStatus).toBe("new");
    }
  });
});

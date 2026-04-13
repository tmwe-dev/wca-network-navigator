import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function seedTestData() {
  const testUser = {
    email: "test@wca-navigator.test",
    password: "test-password-123",
  };

  await supabase.from("partners").insert([
    {
      company_name: "Test Partner Alpha",
      country: "Italy",
      country_code: "IT",
      status: "active",
      lead_status: "prospect",
      user_id: "00000000-0000-0000-0000-000000000000",
    },
    {
      company_name: "Test Partner Beta",
      country: "Germany",
      country_code: "DE",
      status: "active",
      lead_status: "in_progress",
      user_id: "00000000-0000-0000-0000-000000000000",
    },
  ]);

  await supabase.from("imported_contacts").insert([
    {
      name: "Mario Rossi",
      email: "mario@test.com",
      source: "test",
      user_id: "00000000-0000-0000-0000-000000000000",
    },
    {
      name: "Hans Müller",
      email: "hans@test.de",
      source: "test",
      user_id: "00000000-0000-0000-0000-000000000000",
    },
  ]);

  await supabase.from("agents").insert([
    {
      name: "Test Agent",
      role: "outreach",
      is_active: true,
      user_id: "00000000-0000-0000-0000-000000000000",
    },
  ]);

  return testUser;
}

export async function cleanupTestData() {
  await supabase.from("agents").delete().eq("name", "Test Agent");
  await supabase.from("imported_contacts").delete().eq("email", "mario@test.com");
  await supabase.from("imported_contacts").delete().eq("email", "hans@test.de");
  await supabase.from("partners").delete().eq("company_name", "Test Partner Alpha");
  await supabase.from("partners").delete().eq("company_name", "Test Partner Beta");
}

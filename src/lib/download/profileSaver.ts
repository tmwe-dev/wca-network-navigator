import { supabase } from "@/integrations/supabase/client";

/**
 * Saves extracted profile data, contacts, and company name to the database.
 * Returns extraction result stats.
 */
export async function saveExtractionResult(
  partnerId: string,
  wcaId: number,
  result: any,
  existingCompanyName: string,
) {
  let hasEmail = false;
  let hasPhone = false;
  let profileSaved = false;
  let companyName = existingCompanyName;
  let extractedEmailCount = 0;
  let extractedPhoneCount = 0;

  // ── Save contacts (deduplicate by name) ──
  if (result.success && result.contacts?.length > 0) {
    const { data: existingContacts } = await supabase
      .from("partner_contacts")
      .select("id, name, email")
      .eq("partner_id", partnerId);
    const existingByName = new Map(
      (existingContacts || []).map((c) => [c.name?.trim().toLowerCase(), c])
    );

    for (const c of result.contacts) {
      const nameKey = (c.name || c.title || "Sconosciuto").trim().toLowerCase();
      if (!existingByName.has(nameKey)) {
        await supabase.from("partner_contacts").insert({
          partner_id: partnerId,
          name: c.name || c.title || "Sconosciuto",
          title: c.title || null,
          email: c.email || null,
          direct_phone: c.phone || null,
          mobile: c.mobile || null,
        });
      } else {
        const ex = existingByName.get(nameKey)!;
        const updates: Record<string, string> = {};
        if (c.email && !ex.email) updates.email = c.email;
        if (Object.keys(updates).length > 0)
          await supabase.from("partner_contacts").update(updates).eq("id", ex.id);
      }
      if (c.email) hasEmail = true;
      if (c.phone || c.mobile) hasPhone = true;
    }
    extractedEmailCount = result.contacts.filter((c: any) => c.email).length;
    extractedPhoneCount = result.contacts.filter((c: any) => c.phone || c.mobile).length;
  }

  // ── Save company name (skip error messages) ──
  if (
    result.companyName &&
    !result.companyName.startsWith("WCA ") &&
    !result.companyName.toLowerCase().includes("member not found")
  ) {
    companyName = result.companyName;
    await supabase.from("partners").update({ company_name: companyName }).eq("id", partnerId);
  }

  // ── Save profile data ──
  if (result.profile) {
    const p = result.profile;
    const upd: Record<string, any> = {};
    if (p.address) upd.address = p.address;
    if (p.phone) upd.phone = p.phone;
    if (p.fax) upd.fax = p.fax;
    if (p.mobile) upd.mobile = p.mobile;
    if (p.emergencyPhone) upd.emergency_phone = p.emergencyPhone;
    if (p.email) upd.email = p.email;
    if (p.website) upd.website = p.website;
    if (p.description) upd.profile_description = p.description;
    if (p.memberSince) upd.member_since = p.memberSince;
    if (p.membershipExpires) upd.membership_expires = p.membershipExpires;
    if (p.officeType) {
      const ot = p.officeType.toLowerCase();
      if (ot.includes("head") || ot.includes("main")) upd.office_type = "head_office";
      else if (ot.includes("branch")) upd.office_type = "branch";
    }
    if (p.branchCities?.length > 0) {
      upd.has_branches = true;
      upd.branch_cities = p.branchCities;
    }
    if (result.profileHtml) upd.raw_profile_html = result.profileHtml;
    if (Object.keys(upd).length > 0) {
      await supabase.from("partners").update(upd).eq("id", partnerId);
      profileSaved = true;
    }
  }
  if (result.profileHtml || result.profile?.description) profileSaved = true;

  return { hasEmail, hasPhone, profileSaved, companyName, extractedEmailCount, extractedPhoneCount };
}

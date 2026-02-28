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
    if (Object.keys(upd).length > 0) {
      await supabase.from("partners").update(upd).eq("id", partnerId);
      profileSaved = true;
    }
  }

  // Save raw HTML independently — even if structured profile is empty
  if (result.profileHtml) {
    await supabase.from("partners").update({ raw_profile_html: result.profileHtml }).eq("id", partnerId);
    profileSaved = true;
  }

  // ── A) Save networks ──
  if (result.profile?.networks?.length > 0) {
    const { data: existingNets } = await supabase
      .from("partner_networks").select("network_name").eq("partner_id", partnerId);
    const existingSet = new Set((existingNets || []).map((n) => n.network_name?.toLowerCase()));
    const toInsert = result.profile.networks
      .filter((n: any) => n.name && !existingSet.has(n.name.trim().toLowerCase()))
      .map((n: any) => ({
        partner_id: partnerId,
        network_name: n.name.trim(),
        expires: n.expires || null,
      }));
    if (toInsert.length > 0) {
      await supabase.from("partner_networks").insert(toInsert);
    }
  }

  // ── B) Save services ──
  if (result.profile?.services?.length > 0) {
    const serviceMap: Record<string, string> = {
      air: "air_freight", "air freight": "air_freight",
      "ocean fcl": "ocean_fcl", "sea fcl": "ocean_fcl", fcl: "ocean_fcl",
      "ocean lcl": "ocean_lcl", "sea lcl": "ocean_lcl", lcl: "ocean_lcl",
      ocean: "ocean_fcl", sea: "ocean_fcl",
      road: "road_freight", "road freight": "road_freight", truck: "road_freight",
      rail: "rail_freight", "rail freight": "rail_freight", train: "rail_freight",
      project: "project_cargo", "project cargo": "project_cargo",
      dangerous: "dangerous_goods", "dangerous goods": "dangerous_goods", hazardous: "dangerous_goods", dg: "dangerous_goods",
      perishable: "perishables", perishables: "perishables",
      pharma: "pharma", pharmaceutical: "pharma",
      ecommerce: "ecommerce", "e-commerce": "ecommerce",
      relocation: "relocations", relocations: "relocations",
      customs: "customs_broker", "customs broker": "customs_broker", "customs brokerage": "customs_broker",
      warehouse: "warehousing", warehousing: "warehousing",
      nvocc: "nvocc",
    };
    const mapService = (text: string): string | null => {
      const lower = text.trim().toLowerCase();
      if (serviceMap[lower]) return serviceMap[lower];
      for (const [key, val] of Object.entries(serviceMap)) {
        if (lower.includes(key)) return val;
      }
      return null;
    };
    const mapped = [...new Set(
      result.profile.services.map((s: string) => mapService(s)).filter(Boolean) as string[]
    )];
    if (mapped.length > 0) {
      const { data: existingSvc } = await supabase
        .from("partner_services").select("service_category").eq("partner_id", partnerId);
      const existingSet = new Set((existingSvc || []).map((s) => s.service_category as string));
      const toInsert = mapped.filter((s) => !existingSet.has(s)).map((s) => ({
        partner_id: partnerId,
        service_category: s as any,
      }));
      if (toInsert.length > 0) {
        await supabase.from("partner_services").insert(toInsert);
      }
    }
  }

  // ── C) Save certifications ──
  if (result.profile?.certifications?.length > 0) {
    const validCerts = ["IATA", "BASC", "ISO", "C-TPAT", "AEO"] as const;
    const mapCert = (text: string): typeof validCerts[number] | null => {
      const upper = text.trim().toUpperCase();
      for (const cert of validCerts) {
        if (upper.includes(cert)) return cert;
      }
      if (upper.includes("CTPAT")) return "C-TPAT";
      return null;
    };
    const mapped = [...new Set(
      result.profile.certifications.map((c: string) => mapCert(c)).filter(Boolean) as string[]
    )];
    if (mapped.length > 0) {
      const { data: existingCerts } = await supabase
        .from("partner_certifications").select("certification").eq("partner_id", partnerId);
      const existingSet = new Set((existingCerts || []).map((c) => c.certification as string));
      const toInsert = mapped.filter((c) => !existingSet.has(c)).map((c) => ({
        partner_id: partnerId,
        certification: c as any,
      }));
      if (toInsert.length > 0) {
        await supabase.from("partner_certifications").insert(toInsert);
      }
    }
  }

  return { hasEmail, hasPhone, profileSaved, companyName, extractedEmailCount, extractedPhoneCount };
}

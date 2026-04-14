import { updatePartner } from "@/data/partners";
import {
  findPartnerContacts, insertPartnerContacts, updatePartnerContact,
  findPartnerNetworks, insertPartnerNetworks,
  findPartnerServices, insertPartnerServices,
  findPartnerCertifications, insertPartnerCertifications,
} from "@/data/partnerRelations";

/** Shape of the scraper extraction result */
interface ExtractionResult {
  success?: boolean;
  companyName?: string;
  profileHtml?: string;
  contacts?: Array<{ name?: string; title?: string; email?: string; phone?: string; mobile?: string }>;
  profile?: {
    address?: string; phone?: string; fax?: string; mobile?: string; emergencyPhone?: string;
    email?: string; website?: string; description?: string; memberSince?: string;
    membershipExpires?: string; officeType?: string; branchCities?: string[];
    networks?: Array<{ name: string; expires?: string | null }>;
    services?: string[];
    certifications?: string[];
  };
}

/**
 * V2: Saves extracted profile data with BATCHED operations.
 */
export async function saveExtractionResult(
  partnerId: string,
  wcaId: number,
  result: ExtractionResult,
  existingCompanyName: string,
) {
  let hasEmail = false;
  let hasPhone = false;
  let profileSaved = false;
  let companyName = existingCompanyName;
  let extractedEmailCount = 0;
  let extractedPhoneCount = 0;

  // ── 1. Build unified partner update payload ──
  const partnerUpdate: Record<string, unknown> = {};

  if (
    result.companyName &&
    !result.companyName.startsWith("WCA ") &&
    !result.companyName.toLowerCase().includes("member not found")
  ) {
    companyName = result.companyName;
    partnerUpdate.company_name = companyName;
  }

  if (result.profile) {
    const p = result.profile;
    if (p.address) partnerUpdate.address = p.address;
    if (p.phone) partnerUpdate.phone = p.phone;
    if (p.fax) partnerUpdate.fax = p.fax;
    if (p.mobile) partnerUpdate.mobile = p.mobile;
    if (p.emergencyPhone) partnerUpdate.emergency_phone = p.emergencyPhone;
    if (p.email) partnerUpdate.email = p.email;
    if (p.website) partnerUpdate.website = p.website;
    if (p.description) partnerUpdate.profile_description = p.description;
    if (p.memberSince) partnerUpdate.member_since = p.memberSince;
    if (p.membershipExpires) partnerUpdate.membership_expires = p.membershipExpires;
    if (p.officeType) {
      const ot = p.officeType.toLowerCase();
      if (ot.includes("head") || ot.includes("main")) partnerUpdate.office_type = "head_office";
      else if (ot.includes("branch")) partnerUpdate.office_type = "branch";
    }
    if ((p.branchCities?.length ?? 0) > 0) {
      partnerUpdate.has_branches = true;
      partnerUpdate.branch_cities = p.branchCities;
    }
  }

  if (result.profileHtml) {
    partnerUpdate.raw_profile_html = result.profileHtml;
  }

  // ── 2. Execute single partner UPDATE ──
  if (Object.keys(partnerUpdate).length > 0) {
    await updatePartner(partnerId, partnerUpdate);
    profileSaved = true;
  }

  // ── 3. Batch save contacts ──
  if (result.success && (result.contacts?.length ?? 0) > 0) {
    const contacts = result.contacts!;
    const existingContacts = await findPartnerContacts(partnerId, "id, name, email");
    const existingByName = new Map(
      (existingContacts || []).map((c) => [c.name?.trim().toLowerCase(), c])
    );

    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate: Array<{ id: string; updates: Record<string, string> }> = [];

    for (const c of contacts) {
      const nameKey = (c.name || c.title || "Sconosciuto").trim().toLowerCase();
      if (!existingByName.has(nameKey)) {
        toInsert.push({
          partner_id: partnerId,
          name: c.name || c.title || "Sconosciuto",
          title: c.title || null,
          email: c.email || null,
          direct_phone: c.phone || null,
          mobile: c.mobile || null,
        });
      } else {
        const ex = existingByName.get(nameKey)!;
        if (c.email && !ex.email) {
          toUpdate.push({ id: ex.id, updates: { email: c.email } });
        }
      }
      if (c.email) hasEmail = true;
      if (c.phone || c.mobile) hasPhone = true;
    }

    await insertPartnerContacts(toInsert);
    for (const { id, updates } of toUpdate) {
      await updatePartnerContact(id, updates);
    }

    extractedEmailCount = contacts.filter((c) => c.email).length;
    extractedPhoneCount = contacts.filter((c) => c.phone || c.mobile).length;
  }

  // ── 4. Batch save networks ──
  if ((result.profile?.networks?.length ?? 0) > 0) {
    const networks = result.profile!.networks!;
    const existingNets = await findPartnerNetworks(partnerId);
    const existingSet = new Set((existingNets || []).map((n) => n.network_name?.toLowerCase()));
    const toInsert = networks
      .filter((n) => n.name && !existingSet.has(n.name.trim().toLowerCase()))
      .map((n) => ({ partner_id: partnerId, network_name: n.name.trim(), expires: n.expires || null }));
    await insertPartnerNetworks(toInsert);
  }

  // ── 5. Batch save services ──
  if ((result.profile?.services?.length ?? 0) > 0) {
    const services = result.profile!.services!;
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
      services.map((s: string) => mapService(s)).filter(Boolean) as string[]
    )];
    if (mapped.length > 0) {
      const existingSvc = await findPartnerServices(partnerId);
      const existingSet = new Set((existingSvc || []).map((s) => s.service_category as string));
      const toInsert = mapped.filter((s) => !existingSet.has(s)).map((s) => ({
        partner_id: partnerId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase enum cast required
        service_category: s as unknown,
      }));
      await insertPartnerServices(toInsert);
    }
  }

  // ── 6. Batch save certifications ──
  if ((result.profile?.certifications?.length ?? 0) > 0) {
    const certifications = result.profile!.certifications!;
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
      certifications.map((c: string) => mapCert(c)).filter(Boolean) as string[]
    )];
    if (mapped.length > 0) {
      const existingCerts = await findPartnerCertifications(partnerId);
      const existingSet = new Set((existingCerts || []).map((c) => c.certification as string));
      const toInsert = mapped.filter((c) => !existingSet.has(c)).map((c) => ({
        partner_id: partnerId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase enum cast required
        certification: c as unknown,
      }));
      await insertPartnerCertifications(toInsert);
    }
  }

  return { hasEmail, hasPhone, profileSaved, companyName, extractedEmailCount, extractedPhoneCount };
}

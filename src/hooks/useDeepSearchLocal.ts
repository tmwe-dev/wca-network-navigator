/**
 * useDeepSearchLocal — Client-side Deep Search using Partner Connect extension + AI Gateway
 * Level 2: Standard Deep Search (LinkedIn, WhatsApp, Website, Company Profile, Contact Profile)
 * NO Facebook personal, NO Instagram personal.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";

// Lovable AI Gateway
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash-lite";

async function aiCall(prompt: string, apiKey: string): Promise<string | null> {
  const resp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

function toWhatsAppNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, "").replace(/^\+/, "");
}

function extractSeniority(title: string | undefined): { seniority: string; linkedin_title: string } | null {
  if (!title) return null;
  const parts = title.split(" - ");
  if (parts.length < 2) return null;
  const role = parts[1].split(" | ")[0]?.trim();
  if (!role) return null;
  const senior = ["CEO", "Director", "VP", "President", "Owner", "Founder", "Managing", "General Manager", "Head", "Chief", "Partner", "Principal"];
  const mid = ["Manager", "Supervisor", "Lead", "Senior", "Coordinator", "Team Lead"];
  let seniority = "junior";
  if (senior.some((k) => role.includes(k))) seniority = "senior";
  else if (mid.some((k) => role.includes(k))) seniority = "mid";
  return { seniority, linkedin_title: role };
}

function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

/** Extract company keyword from email domain, excluding generic providers */
function extractDomainKeyword(email: string | null | undefined): string | null {
  if (!email) return null;
  const genericDomains = /^(gmail|yahoo|hotmail|outlook|live|msn|aol|icloud|me|mac|libero|alice|tin|virgilio|tiscali|fastwebnet|aruba|pec|legalmail|mail|protonmail|zoho|yandex|gmx|web|email|inbox)\b/i;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1].split(".")[0];
  if (!domain || domain.length < 2 || genericDomains.test(domain)) return null;
  return domain;
}

async function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

interface GoogleSearchResult {
  url: string;
  title: string;
  snippet: string;
}

export function useDeepSearchLocal() {
  const fs = useFireScrapeExtensionBridge();

  /** Google search via Partner Connect agent sequence */
  const googleSearch = useCallback(async (query: string, limit = 5): Promise<GoogleSearchResult[]> => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${limit}&hl=en`;
    const navResult = await fs.agentAction({ action: "navigate", url: searchUrl });
    if (!navResult.success) return [];
    await delay(2000);
    const extractResult = await fs.extract({
      results_links: "div.g a[href^='http'] h3",
      results_urls: "div.g a[href^='http']",
      results_snippets: "div.g div.VwiC3b, div.g span.aCOpRe",
    });
    if (!extractResult.success || !extractResult.data) return [];
    const titles = Array.isArray(extractResult.data.results_links) ? extractResult.data.results_links : extractResult.data.results_links ? [extractResult.data.results_links] : [];
    const urls = Array.isArray(extractResult.data.results_urls) ? extractResult.data.results_urls : extractResult.data.results_urls ? [extractResult.data.results_urls] : [];
    const snippets = Array.isArray(extractResult.data.results_snippets) ? extractResult.data.results_snippets : extractResult.data.results_snippets ? [extractResult.data.results_snippets] : [];
    const results: GoogleSearchResult[] = [];
    for (let i = 0; i < Math.min(titles.length, limit); i++) {
      results.push({ url: urls[i] || "", title: titles[i] || "", snippet: snippets[i] || "" });
    }
    return results;
  }, [fs]);

  /** Scrape a URL via Partner Connect */
  const scrapeUrl = useCallback(async (url: string) => {
    const navResult = await fs.agentAction({ action: "navigate", url });
    if (!navResult.success) return null;
    await delay(2000);
    const result = await fs.scrape(true);
    if (!result.success) return null;
    return {
      title: result.metadata?.title || "",
      description: result.metadata?.description || "",
      markdown: result.markdown || "",
      logoUrl: null as string | null,
    };
  }, [fs]);

  // ═══════════════════════════════════════════════════════
  // Shared search logic for both partners and contacts
  // ═══════════════════════════════════════════════════════

  /** Search LinkedIn profiles for contacts */
  const searchLinkedInForContacts = useCallback(async (
    contacts: Array<{ id: string; name: string; title?: string | null; email?: string | null; mobile?: string | null; direct_phone?: string | null }>,
    companyName: string,
    location: string,
    partnerId: string,
    existingSet: Set<string>,
    apiKey: string | null,
  ) => {
    let socialLinksFound = 0;
    const contactProfiles: Record<string, any> = {};

    for (const contact of contacts) {
      if (!contact.name || contact.name.length < 3) continue;

      // --- LinkedIn Personal (Cascade Search) ---
      if (!existingSet.has(`${contact.id}_linkedin`)) {
        const domainKw = extractDomainKeyword(contact.email);
        const lastName = getLastName(contact.name);
        const cascadeQueries = [
          `"${contact.name}" "${companyName}" site:linkedin.com/in`,
          ...(domainKw ? [`"${contact.name}" "${domainKw}" site:linkedin.com/in`] : []),
          `"${contact.name}" site:linkedin.com/in`,
          ...(domainKw ? [`"${lastName}" "${domainKw}" site:linkedin.com/in`] : []),
          `${contact.name} LinkedIn`,
        ];

        let results: GoogleSearchResult[] = [];
        for (const q of cascadeQueries) {
          results = (await googleSearch(q, 5)).filter((r) => r.url?.includes("linkedin.com/in/"));
          if (results.length > 0) break;
          await delay(500);
        }

        if (results.length > 0 && apiKey) {
          const domainHint = domainKw ? ` Email domain: "${domainKw}".` : "";
          const answer = await aiCall(
            `Find the PERSONAL LinkedIn profile of "${contact.name}" at "${companyName}" in ${location}.${contact.title ? ` Title: "${contact.title}"` : ""}${domainHint}
Results:\n${results.map((r, i) => `${i + 1}. ${r.url} - ${r.title}`).join("\n")}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
            apiKey
          );
          if (answer && answer !== "NONE" && answer.includes("linkedin.com/in/")) {
            const m = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/);
            if (m) {
              const { error } = await supabase.from("partner_social_links").insert({
                partner_id: partnerId, contact_id: contact.id, platform: "linkedin", url: m[1].replace(/\/$/, ""),
              });
              if (!error) socialLinksFound++;
              const sr = extractSeniority(results[0]?.title);
              if (sr) contactProfiles[contact.id] = { name: contact.name, title: contact.title, ...sr };
            }
          }
        }
        await delay(800);
      }

      // --- WhatsApp auto-link ---
      const waNumber = contact.mobile || contact.direct_phone;
      if (waNumber && !existingSet.has(`${contact.id}_whatsapp`)) {
        const cleaned = toWhatsAppNumber(waNumber);
        if (cleaned.length >= 8) {
          const { error } = await supabase.from("partner_social_links").insert({
            partner_id: partnerId, contact_id: contact.id, platform: "whatsapp", url: `https://wa.me/${cleaned}`,
          });
          if (!error) socialLinksFound++;
        }
      }
    }

    return { socialLinksFound, contactProfiles };
  }, [googleSearch]);

  /** Search company LinkedIn page */
  const searchCompanyLinkedIn = useCallback(async (
    companyName: string, partnerId: string, existingSet: Set<string>,
  ) => {
    if (existingSet.has("company_linkedin")) return 0;
    const q = `"${companyName}" site:linkedin.com/company`;
    const res = await googleSearch(q, 3);
    const match = res.find((r) => r.url?.includes("linkedin.com/company/"));
    if (match) {
      const { error } = await supabase.from("partner_social_links").insert({
        partner_id: partnerId, contact_id: null, platform: "linkedin", url: match.url.replace(/\/$/, ""),
      });
      if (!error) { await delay(500); return 1; }
    }
    await delay(500);
    return 0;
  }, [googleSearch]);

  /** Scrape website + logo + quality score */
  const scrapeWebsite = useCallback(async (
    website: string | null, partnerId: string, apiKey: string | null,
    contacts?: Array<{ email?: string | null }>,
  ) => {
    let logoFound = false;
    let websiteQualityScore = 0;

    if (website) {
      const websiteUrl = website.startsWith("http") ? website : `https://${website}`;
      const scraped = await scrapeUrl(websiteUrl);
      if (scraped) {
        let logoUrl: string | null = null;
        try {
          const domain = new URL(websiteUrl).hostname;
          logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        } catch { /* intentionally ignored: best-effort cleanup */ }
        if (logoUrl) {
          const { error } = await supabase.from("partners").update({ logo_url: logoUrl }).eq("id", partnerId);
          if (!error) logoFound = true;
        }
        if (scraped.markdown && scraped.markdown.length > 100 && apiKey) {
          const qa = await aiCall(
            `Rate this logistics company website 1-5 for: design, content, professionalism, business quality. Respond with ONLY a number.\n\n${scraped.markdown.slice(0, 2000)}`,
            apiKey
          );
          if (qa) {
            const parsed = parseInt(qa.replace(/[^1-5]/g, ""));
            if (parsed >= 1 && parsed <= 5) websiteQualityScore = parsed;
          }
        }
      }
    } else if (contacts && contacts.length > 0) {
      const ce = contacts.find((c) => c.email && !/(gmail|yahoo|hotmail|outlook)/i.test(c.email));
      if (ce?.email) {
        const domain = ce.email.split("@")[1];
        if (domain) await supabase.from("partners").update({ website: `https://${domain}` }).eq("id", partnerId);
      }
    }
    return { logoFound, websiteQualityScore };
  }, [scrapeUrl]);

  /** Calculate partner rating */
  const calculateRating = useCallback(async (
    partnerId: string, websiteQualityScore: number, website: string | null,
    memberSince: string | null, branchCities: any,
  ) => {
    const { data: servicesData } = await supabase.from("partner_services").select("service_category").eq("partner_id", partnerId);
    const { data: networksData } = await supabase.from("partner_networks").select("network_name").eq("partner_id", partnerId);
    const services = servicesData ?? [];
    const networks = networksData ?? [];

    const websiteScore = websiteQualityScore || (website ? 2 : 1);
    const svcSet = new Set(services.map((s: any) => s.service_category));
    let serviceMix = 1;
    if (svcSet.has("air_freight")) serviceMix += 1.5;
    if (svcSet.has("road_freight")) serviceMix += 1;
    if (svcSet.has("warehousing")) serviceMix += 1;
    serviceMix = Math.min(5, Math.max(1, serviceMix));

    let networkScore = 1;
    if (networks.length >= 5) networkScore = 5;
    else if (networks.length >= 3) networkScore = 3;
    else if (networks.length >= 1) networkScore = 1.5;

    let seniorityScore = 1;
    if (memberSince) {
      const years = (Date.now() - new Date(memberSince).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (years >= 20) seniorityScore = 5;
      else if (years >= 10) seniorityScore = 3;
      else if (years >= 5) seniorityScore = 2;
    }

    const bc = Array.isArray(branchCities) ? branchCities : [];
    let internationalScore = 1;
    if (bc.length >= 10) internationalScore = 5;
    else if (bc.length >= 3) internationalScore = 3;
    else if (bc.length >= 1) internationalScore = 2;

    const rawRating = websiteScore * 0.2 + serviceMix * 0.2 + networkScore * 0.15 + seniorityScore * 0.15 + internationalScore * 0.1 + 1 * 0.1 + 1 * 0.1;
    return Math.min(5, Math.max(1, Math.round(rawRating * 2) / 2));
  }, []);

  // ═══════════════════════════════════════════════════════
  // searchPartner — Deep Search for a partner record
  // ═══════════════════════════════════════════════════════
  const searchPartner = useCallback(async (partnerId: string): Promise<{
    success: boolean;
    socialLinksFound: number;
    logoFound: boolean;
    contactProfilesFound: number;
    companyProfileFound: boolean;
    rating: number;
    rateLimited: boolean;
    companyName: string;
    error?: string;
  }> => {
    const apiKey = import.meta.env.VITE_LOVABLE_API_KEY || null;

    const { data: partner, error: pErr } = await supabase
      .from("partners")
      .select("id, company_name, website, city, country_name, enrichment_data, email, profile_description, member_since, phone, branch_cities, has_branches")
      .eq("id", partnerId)
      .single();

    if (pErr || !partner) return { success: false, socialLinksFound: 0, logoFound: false, contactProfilesFound: 0, companyProfileFound: false, rating: 0, rateLimited: false, companyName: "?", error: "Partner not found" };

    const { data: contactsData } = await supabase
      .from("partner_contacts")
      .select("id, name, title, email, mobile, direct_phone")
      .eq("partner_id", partnerId);
    const contacts = contactsData ?? [];

    const { data: existingLinksData } = await supabase
      .from("partner_social_links")
      .select("contact_id, platform")
      .eq("partner_id", partnerId);
    const existingLinks = existingLinksData ?? [];

    const existingSet = new Set(existingLinks.map((l) => `${l.contact_id || "company"}_${l.platform}`));
    const location = `${partner.city || ""} ${partner.country_name || ""}`.trim();

    // LinkedIn + WhatsApp for contacts
    const { socialLinksFound: contactLinks, contactProfiles } = await searchLinkedInForContacts(
      contacts || [], partner.company_name, location, partnerId, existingSet, apiKey,
    );

    // Company LinkedIn
    const companyLinks = await searchCompanyLinkedIn(partner.company_name, partnerId, existingSet);

    // Website + Logo
    const { logoFound, websiteQualityScore } = await scrapeWebsite(
      partner.website, partnerId, apiKey, contacts,
    );

    // Save enrichment
    const existing = (partner.enrichment_data as any) || {};
    const updated = {
      ...existing,
      ...(Object.keys(contactProfiles).length > 0 ? { contact_profiles: contactProfiles } : {}),
      ...(websiteQualityScore > 0 ? { website_quality_score: websiteQualityScore } : {}),
      deep_search_at: new Date().toISOString(),
      deep_search_engine: "partner-connect-v3.3",
    };
    await supabase.from("partners").update({ enrichment_data: updated }).eq("id", partnerId);

    // Rating
    const rating = await calculateRating(partnerId, websiteQualityScore, partner.website, partner.member_since, partner.branch_cities);
    await supabase.from("partners").update({ rating }).eq("id", partnerId);

    const socialLinksFound = contactLinks + companyLinks;

    return {
      success: true,
      socialLinksFound,
      logoFound,
      contactProfilesFound: Object.keys(contactProfiles).length,
      companyProfileFound: companyLinks > 0,
      rating,
      rateLimited: false,
      companyName: partner.company_name,
    };
  }, [fs, googleSearch, scrapeUrl, searchLinkedInForContacts, searchCompanyLinkedIn, scrapeWebsite, calculateRating]);

  // ═══════════════════════════════════════════════════════
  // searchContact — Deep Search for an imported_contacts record
  // ═══════════════════════════════════════════════════════
  const searchContact = useCallback(async (contactId: string): Promise<{
    success: boolean;
    socialLinksFound: number;
    logoFound: boolean;
    contactProfilesFound: number;
    companyProfileFound: boolean;
    rating: number;
    rateLimited: boolean;
    companyName: string;
    error?: string;
  }> => {
    const apiKey = import.meta.env.VITE_LOVABLE_API_KEY || null;

    const { data: contact, error: cErr } = await supabase
      .from("imported_contacts")
      .select("id, name, company_name, email, phone, mobile, country, city, position, enrichment_data")
      .eq("id", contactId)
      .single();

    if (cErr || !contact) return { success: false, socialLinksFound: 0, logoFound: false, contactProfilesFound: 0, companyProfileFound: false, rating: 0, rateLimited: false, companyName: "?", error: "Contact not found" };

    const companyName = contact.company_name || "Unknown";
    const location = `${contact.city || ""} ${contact.country || ""}`.trim();

    // Check if this contact is linked to a partner
    let partnerId: string | null = null;
    if (contact.company_name) {
      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .ilike("company_name", `%${contact.company_name}%`)
        .maybeSingle();
      partnerId = partner?.id || null;
    }

    let socialLinksFound = 0;
    const contactProfiles: Record<string, any> = {};

    // --- LinkedIn Personal (Cascade Search) ---
    if (contact.name && contact.name.length >= 3 && apiKey) {
      const domainKw = extractDomainKeyword(contact.email);
      const lastName = getLastName(contact.name);
      const cascadeQueries = [
        `"${contact.name}" "${companyName}" site:linkedin.com/in`,
        ...(domainKw ? [`"${contact.name}" "${domainKw}" site:linkedin.com/in`] : []),
        `"${contact.name}" site:linkedin.com/in`,
        ...(domainKw ? [`"${lastName}" "${domainKw}" site:linkedin.com/in`] : []),
        `${contact.name} LinkedIn`,
      ];

      let results: GoogleSearchResult[] = [];
      for (const q of cascadeQueries) {
        results = (await googleSearch(q, 5)).filter((r) => r.url?.includes("linkedin.com/in/"));
        if (results.length > 0) break;
        await delay(500);
      }

      if (results.length > 0) {
        const domainHint = domainKw ? ` Email domain: "${domainKw}".` : "";
        const answer = await aiCall(
          `Find the PERSONAL LinkedIn profile of "${contact.name}" at "${companyName}" in ${location}.${contact.position ? ` Title: "${contact.position}"` : ""}${domainHint}
Results:\n${results.map((r, i) => `${i + 1}. ${r.url} - ${r.title}`).join("\n")}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
          apiKey
        );
        if (answer && answer !== "NONE" && answer.includes("linkedin.com/in/")) {
          const m = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/);
          if (m) {
            socialLinksFound++;
            const sr = extractSeniority(results[0]?.title);
            if (sr) contactProfiles[contactId] = { name: contact.name, title: contact.position, ...sr };

            if (partnerId) {
              await supabase.from("partner_social_links").insert({
                partner_id: partnerId, contact_id: null, platform: "linkedin", url: m[1].replace(/\/$/, ""),
              });
            }
          }
        }
      }
      await delay(800);
    }

    // --- WhatsApp auto-link ---
    const waNumber = contact.mobile || contact.phone;
    if (waNumber) {
      const cleaned = toWhatsAppNumber(waNumber);
      if (cleaned.length >= 8) {
        socialLinksFound++;
        if (partnerId) {
          await supabase.from("partner_social_links").insert({
            partner_id: partnerId, contact_id: null, platform: "whatsapp", url: `https://wa.me/${cleaned}`,
          });
        }
      }
    }

    // --- Company LinkedIn ---
    let companyProfileFound = false;
    if (companyName !== "Unknown") {
      const q = `"${companyName}" site:linkedin.com/company`;
      const res = await googleSearch(q, 3);
      const match = res.find((r) => r.url?.includes("linkedin.com/company/"));
      if (match) {
        companyProfileFound = true;
        socialLinksFound++;
        if (partnerId) {
          await supabase.from("partner_social_links").insert({
            partner_id: partnerId, contact_id: null, platform: "linkedin", url: match.url.replace(/\/$/, ""),
          });
        }
      }
      await delay(500);
    }

    // --- Website from email domain ---
    let websiteUrl: string | null = null;
    if (contact.email && !/(gmail|yahoo|hotmail|outlook|libero|alice|tin\.it)/i.test(contact.email)) {
      const domain = contact.email.split("@")[1];
      if (domain) websiteUrl = `https://${domain}`;
    }

    let logoFound = false;
    let websiteQualityScore = 0;
    if (websiteUrl) {
      const scraped = await scrapeUrl(websiteUrl);
      if (scraped) {
        try {
          const domain = new URL(websiteUrl).hostname;
          const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          if (logoUrl) logoFound = true;
        } catch { /* intentionally ignored: best-effort cleanup */ }
        if (scraped.markdown && scraped.markdown.length > 100 && apiKey) {
          const qa = await aiCall(
            `Rate this company website 1-5 for: design, content, professionalism, business quality. Respond with ONLY a number.\n\n${scraped.markdown.slice(0, 2000)}`,
            apiKey
          );
          if (qa) {
            const parsed = parseInt(qa.replace(/[^1-5]/g, ""));
            if (parsed >= 1 && parsed <= 5) websiteQualityScore = parsed;
          }
        }
      }
    }

    // --- Save enrichment data ---
    const existing = (contact.enrichment_data as any) || {};
    const linkedinUrl = Object.values(contactProfiles).length > 0 ? undefined : undefined; // stored via social_links
    const updated = {
      ...existing,
      ...(Object.keys(contactProfiles).length > 0 ? { contact_profiles: contactProfiles } : {}),
      ...(websiteQualityScore > 0 ? { website_quality_score: websiteQualityScore } : {}),
      ...(websiteUrl ? { discovered_website: websiteUrl } : {}),
      ...(companyProfileFound ? { company_linkedin_found: true } : {}),
      deep_search_at: new Date().toISOString(),
      deep_search_engine: "partner-connect-v3.3",
    };

    await supabase.from("imported_contacts").update({
      enrichment_data: updated,
      deep_search_at: new Date().toISOString(),
    }).eq("id", contactId);

    return {
      success: true,
      socialLinksFound,
      logoFound,
      contactProfilesFound: Object.keys(contactProfiles).length,
      companyProfileFound,
      rating: websiteQualityScore || 0,
      rateLimited: false,
      companyName,
    };
  }, [fs, googleSearch, scrapeUrl]);

  return { searchPartner, searchContact, isAvailable: fs.isAvailable };
}

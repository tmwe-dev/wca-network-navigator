/**
 * useDeepSearchLocal — Client-side Deep Search using Partner Connect extension + AI Gateway
 * Decomposed: pure helpers in useDeepSearchHelpers.ts
 */
import { useCallback } from "react";
import { updatePartner, findPartnerByName, getPartner } from "@/data/partners";
import { updateContactEnrichment } from "@/data/contacts";
import { findPartnerContacts, findPartnerSocialLinks, insertPartnerSocialLink } from "@/data/partnerRelations";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { createLogger } from "@/lib/log";
import {
  toWhatsAppNumber, extractSeniority, getLastName, extractDomainKeyword,
  delay, aiCall, calculateRating, type GoogleSearchResult,
} from "./useDeepSearchHelpers";

const _log = createLogger("useDeepSearchLocal");

export function useDeepSearchLocal() {
  const fs = useFireScrapeExtensionBridge();

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

  const scrapeUrl = useCallback(async (url: string) => {
    const navResult = await fs.agentAction({ action: "navigate", url });
    if (!navResult.success) return null;
    await delay(2000);
    const result = await fs.scrape(true);
    if (!result.success) return null;
    return { title: result.metadata?.title || "", description: result.metadata?.description || "", markdown: result.markdown || "", logoUrl: null as string | null };
  }, [fs]);

  /** Search LinkedIn profiles for contacts */
  const searchLinkedInForContacts = useCallback(async (
    contacts: Array<{ id: string; name: string; title?: string | null; email?: string | null; mobile?: string | null; direct_phone?: string | null }>,
    companyName: string, location: string, partnerId: string, existingSet: Set<string>,
  ) => {
    let socialLinksFound = 0;
    const contactProfiles: Record<string, Record<string, string>> = {};

    for (const contact of contacts) {
      if (!contact.name || contact.name.length < 3) continue;
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
        if (results.length > 0) {
          const domainHint = domainKw ? ` Email domain: "${domainKw}".` : "";
          const answer = await aiCall(
            `Find the PERSONAL LinkedIn profile of "${contact.name}" at "${companyName}" in ${location}.${contact.title ? ` Title: "${contact.title}"` : ""}${domainHint}\nResults:\n${results.map((r, i) => `${i + 1}. ${r.url} - ${r.title}`).join("\n")}\nIf one matches, respond with ONLY the URL. If none, respond "NONE".`
          );
          if (answer && answer !== "NONE" && answer.includes("linkedin.com/in/")) {
            const m = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/);
            if (m) {
              const { error } = await insertPartnerSocialLink({ partner_id: partnerId, contact_id: contact.id, platform: "linkedin", url: m[1].replace(/\/$/, "") });
              if (!error) socialLinksFound++;
              const sr = extractSeniority(results[0]?.title);
              if (sr) contactProfiles[contact.id] = { name: contact.name, title: contact.title || "", ...sr };
            }
          }
        }
        await delay(800);
      }
      const waNumber = contact.mobile || contact.direct_phone;
      if (waNumber && !existingSet.has(`${contact.id}_whatsapp`)) {
        const cleaned = toWhatsAppNumber(waNumber);
        if (cleaned.length >= 8) {
          const { error } = await insertPartnerSocialLink({ partner_id: partnerId, contact_id: contact.id, platform: "whatsapp", url: `https://wa.me/${cleaned}` });
          if (!error) socialLinksFound++;
        }
      }
    }
    return { socialLinksFound, contactProfiles };
  }, [googleSearch]);

  const searchCompanyLinkedIn = useCallback(async (companyName: string, partnerId: string, existingSet: Set<string>) => {
    if (existingSet.has("company_linkedin")) return 0;
    const q = `"${companyName}" site:linkedin.com/company`;
    const res = await googleSearch(q, 3);
    const match = res.find((r) => r.url?.includes("linkedin.com/company/"));
    if (match) {
      const { error } = await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "linkedin", url: match.url.replace(/\/$/, "") });
      if (!error) { await delay(500); return 1; }
    }
    await delay(500);
    return 0;
  }, [googleSearch]);

  const scrapeWebsite = useCallback(async (website: string | null, partnerId: string, contacts?: Array<{ email?: string | null }>) => {
    let logoFound = false;
    let websiteQualityScore = 0;
    if (website) {
      const websiteUrl = website.startsWith("http") ? website : `https://${website}`;
      const scraped = await scrapeUrl(websiteUrl);
      if (scraped) {
        try {
          const domain = new URL(websiteUrl).hostname;
          const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          if (logoUrl) {
            await updatePartner(partnerId, { logo_url: logoUrl });
            logoFound = true;
          }
        } catch { /* best-effort */ }
        if (scraped.markdown && scraped.markdown.length > 100) {
          const qa = await aiCall(`Rate this logistics company website 1-5 for: design, content, professionalism, business quality. Respond with ONLY a number.\n\n${scraped.markdown.slice(0, 2000)}`);
          if (qa) { const parsed = parseInt(qa.replace(/[^1-5]/g, "")); if (parsed >= 1 && parsed <= 5) websiteQualityScore = parsed; }
        }
      }
    } else if (contacts && contacts.length > 0) {
      const ce = contacts.find((c) => c.email && !/(gmail|yahoo|hotmail|outlook)/i.test(c.email));
      if (ce?.email) {
        const domain = ce.email.split("@")[1];
        if (domain) await updatePartner(partnerId, { website: `https://${domain}` });
      }
    }
    return { logoFound, websiteQualityScore };
  }, [scrapeUrl]);

  const searchPartner = useCallback(async (partnerId: string) => {
    const failResult = { success: false, socialLinksFound: 0, logoFound: false, contactProfilesFound: 0, companyProfileFound: false, rating: 0, rateLimited: false, companyName: "?" as string, error: undefined as string | undefined };
    const partner = await getPartner(partnerId) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!partner) return { ...failResult, error: "Partner not found" };

    const contactsData = await findPartnerContacts(partnerId, "id, name, title, email, mobile, direct_phone");
    const contacts = contactsData ?? [];
    const existingLinksData = await findPartnerSocialLinks(partnerId);
    const existingSet = new Set((existingLinksData ?? []).map((l) => `${l.contact_id || "company"}_${l.platform}`));
    const location = `${partner.city || ""} ${partner.country_name || ""}`.trim();

    const { socialLinksFound: contactLinks, contactProfiles } = await searchLinkedInForContacts(contacts, partner.company_name as string, location, partnerId, existingSet);
    const companyLinks = await searchCompanyLinkedIn(partner.company_name as string, partnerId, existingSet);
    const { logoFound, websiteQualityScore } = await scrapeWebsite(partner.website as string | null, partnerId, contacts);

    const existing = (partner.enrichment_data as Record<string, unknown>) || {};
    const updated = {
      ...existing,
      ...(Object.keys(contactProfiles).length > 0 ? { contact_profiles: contactProfiles } : {}),
      ...(websiteQualityScore > 0 ? { website_quality_score: websiteQualityScore } : {}),
      deep_search_at: new Date().toISOString(), deep_search_engine: "partner-connect-v3.3",
    };
    await updatePartner(partnerId, { enrichment_data: updated as unknown as Record<string, string> });

    const rating = await calculateRating(partnerId, websiteQualityScore, partner.website as string | null, partner.member_since as string | null, partner.branch_cities as string | null);
    await updatePartner(partnerId, { rating });

    return { success: true, socialLinksFound: contactLinks + companyLinks, logoFound, contactProfilesFound: Object.keys(contactProfiles).length, companyProfileFound: companyLinks > 0, rating, rateLimited: false, companyName: partner.company_name as string };
  }, [fs, googleSearch, scrapeUrl, searchLinkedInForContacts, searchCompanyLinkedIn, scrapeWebsite]);

  const searchContact = useCallback(async (contactId: string) => {
    const failResult = { success: false, socialLinksFound: 0, logoFound: false, contactProfilesFound: 0, companyProfileFound: false, rating: 0, rateLimited: false, companyName: "?" as string, error: undefined as string | undefined };
    const { getContactsByIds } = await import("@/data/contacts");
    const contacts = await getContactsByIds([contactId], "id, name, company_name, email, phone, mobile, country, city, position, enrichment_data") as unknown[];
    const contact = contacts[0] || null;
    const cErr = !contact ? "not found" : null;
    if (cErr || !contact) return { ...failResult, error: "Contact not found" };

    const companyName = (contact.company_name || "Unknown") as string;
    const location = `${contact.city || ""} ${contact.country || ""}`.trim();
    let partnerId: string | null = null;
    if (contact.company_name) {
      const partner = await findPartnerByName(contact.company_name as string);
      partnerId = partner?.id || null;
    }
    let socialLinksFound = 0;
    const contactProfiles: Record<string, Record<string, string>> = {};

    if (contact.name && (contact.name as string).length >= 3) {
      const domainKw = extractDomainKeyword(contact.email as string | null | undefined);
      const lastName = getLastName(contact.name as string);
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
          `Find the PERSONAL LinkedIn profile of "${contact.name}" at "${companyName}" in ${location}.${contact.position ? ` Title: "${contact.position}"` : ""}${domainHint}\nResults:\n${results.map((r, i) => `${i + 1}. ${r.url} - ${r.title}`).join("\n")}\nIf one matches, respond with ONLY the URL. If none, respond "NONE".`
        );
        if (answer && answer !== "NONE" && answer.includes("linkedin.com/in/")) {
          const m = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/);
          if (m) {
            socialLinksFound++;
            const sr = extractSeniority(results[0]?.title);
            if (sr) contactProfiles[contactId] = { name: contact.name as string, title: (contact.position || "") as string, ...sr };
            if (partnerId) {
              await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "linkedin", url: m[1].replace(/\/$/, "") });
            }
          }
        }
      }
      await delay(800);
    }

    const waNumber = (contact.mobile || contact.phone) as string | null;
    if (waNumber) {
      const cleaned = toWhatsAppNumber(waNumber);
      if (cleaned.length >= 8) {
        socialLinksFound++;
        if (partnerId) await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "whatsapp", url: `https://wa.me/${cleaned}` });
      }
    }

    let companyProfileFound = false;
    if (companyName !== "Unknown") {
      const q = `"${companyName}" site:linkedin.com/company`;
      const res = await googleSearch(q, 3);
      const match = res.find((r) => r.url?.includes("linkedin.com/company/"));
      if (match) {
        companyProfileFound = true; socialLinksFound++;
        if (partnerId) await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "linkedin", url: match.url.replace(/\/$/, "") });
      }
      await delay(500);
    }

    let websiteUrl: string | null = null;
    if (contact.email && !/(gmail|yahoo|hotmail|outlook|libero|alice|tin\.it)/i.test(contact.email as string)) {
      const domain = (contact.email as string).split("@")[1];
      if (domain) websiteUrl = `https://${domain}`;
    }
    let logoFound = false;
    let websiteQualityScore = 0;
    if (websiteUrl) {
      const scraped = await scrapeUrl(websiteUrl);
      if (scraped) {
        try { const domain = new URL(websiteUrl).hostname; if (`https://www.google.com/s2/favicons?domain=${domain}&sz=128`) logoFound = true; } catch { /* best-effort */ }
        if (scraped.markdown && scraped.markdown.length > 100) {
          const qa = await aiCall(`Rate this company website 1-5 for: design, content, professionalism, business quality. Respond with ONLY a number.\n\n${scraped.markdown.slice(0, 2000)}`);
          if (qa) { const parsed = parseInt(qa.replace(/[^1-5]/g, "")); if (parsed >= 1 && parsed <= 5) websiteQualityScore = parsed; }
        }
      }
    }

    const existing = (contact.enrichment_data as Record<string, unknown>) || {};
    const updated = {
      ...existing,
      ...(Object.keys(contactProfiles).length > 0 ? { contact_profiles: contactProfiles } : {}),
      ...(websiteQualityScore > 0 ? { website_quality_score: websiteQualityScore } : {}),
      ...(websiteUrl ? { discovered_website: websiteUrl } : {}),
      ...(companyProfileFound ? { company_linkedin_found: true } : {}),
      deep_search_at: new Date().toISOString(), deep_search_engine: "partner-connect-v3.3",
    };
    await updateContactEnrichment(contactId, { ...updated, deep_search_at: new Date().toISOString() });

    return { success: true, socialLinksFound, logoFound, contactProfilesFound: Object.keys(contactProfiles).length, companyProfileFound, rating: websiteQualityScore || 0, rateLimited: false, companyName };
  }, [fs, googleSearch, scrapeUrl]);

  return { searchPartner, searchContact, isAvailable: fs.isAvailable };
}

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
import { toast } from "sonner";
import {
  toWhatsAppNumber, extractSeniority, getLastName, extractDomainKeyword,
  delay, aiCall, calculateRating, cleanPersonName, cleanCompanyName, cascadeBus,
  type GoogleSearchResult,
} from "./useDeepSearchHelpers";
import {
  searchGoogleGeneral, scrapeGoogleMaps, scrapeWebsiteSubpages, scrapeReputation,
} from "./useDeepSearchExtraSources";

const _log = createLogger("useDeepSearchLocal");

/** Config opzionale iniettabile a livello modulo dal Lab Forge. */
export interface DeepSearchRuntimeConfig {
  scrapeWebsite?: boolean;
  linkedinContacts?: boolean;
  linkedinCompany?: boolean;
  whatsapp?: boolean;
  /** Nuove fonti V2 — attivabili granularmente */
  googleGeneral?: boolean;
  googleMaps?: boolean;
  websiteMultiPage?: boolean;
  reputation?: boolean;
  maxQueriesPerContact?: number;
  priorityDomain?: string;
}
let runtimeConfig: DeepSearchRuntimeConfig = {};
export function setDeepSearchRuntimeConfig(c: DeepSearchRuntimeConfig): void {
  runtimeConfig = { ...c };
}
function cfg<K extends keyof DeepSearchRuntimeConfig>(
  key: K,
  fallback: NonNullable<DeepSearchRuntimeConfig[K]>,
): NonNullable<DeepSearchRuntimeConfig[K]> {
  const v = runtimeConfig[key];
  return (v === undefined ? fallback : v) as NonNullable<DeepSearchRuntimeConfig[K]>;
}

export function useDeepSearchLocal() {
  const fs = useFireScrapeExtensionBridge();

  const googleSearch = useCallback(async (query: string, limit = 5): Promise<GoogleSearchResult[]> => {
    // Preferenza 1: endpoint nativo "google-search" dell'estensione (gira in background, no tab visibile)
    try {
      const nativeRes = await fs.googleSearch(query, limit, false);
      if (nativeRes?.success && Array.isArray(nativeRes.data)) {
        return nativeRes.data.map((r) => ({
          url: r.url || "",
          title: r.title || "",
          snippet: r.description || "",
        }));
      }
    } catch { /* fallback al metodo navigate+extract */ }

    // Fallback: navigate + extract. Richiediamo background:true così l'estensione,
    // se aggiornata, riusa lo stesso tab nascosto invece di aprirne uno nuovo per query.
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${limit}&hl=en`;
    const navResult = await fs.agentAction({ action: "navigate", url: searchUrl, background: true, reuseTab: true });
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
    // background:true + reuseTab:true → estensione (se aggiornata) usa lo stesso tab nascosto
    const navResult = await fs.agentAction({ action: "navigate", url, background: true, reuseTab: true });
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
    const enableLinkedIn = cfg("linkedinContacts", true);
    const enableWhatsApp = cfg("whatsapp", true);
    const maxQ = Math.max(1, Math.min(5, cfg("maxQueriesPerContact", 5)));
    const priorityDomain = (runtimeConfig.priorityDomain || "").trim();
    const cleanCompany = cleanCompanyName(companyName);

    for (const contact of contacts) {
      if (!contact.name || contact.name.length < 3) continue;
      const cleanName = cleanPersonName(contact.name);

      if (enableLinkedIn && !existingSet.has(`${contact.id}_linkedin`)) {
        const domainKw = priorityDomain || extractDomainKeyword(contact.email) || "";
        const lastName = getLastName(cleanName);
        const cascadeQueries = [
          `"${cleanName}" "${cleanCompany}" site:linkedin.com/in`,
          ...(domainKw ? [`"${cleanName}" "${domainKw}" site:linkedin.com/in`] : []),
          `"${cleanName}" site:linkedin.com/in`,
          ...(domainKw ? [`"${lastName}" "${domainKw}" site:linkedin.com/in`] : []),
          `${cleanName} ${cleanCompany} LinkedIn`,
        ].slice(0, maxQ);

        let results: GoogleSearchResult[] = [];
        for (let qi = 0; qi < cascadeQueries.length; qi++) {
          const q = cascadeQueries[qi];
          cascadeBus.emit({ type: "query-start", subjectId: contact.id, query: q, index: qi, total: cascadeQueries.length });
          results = (await googleSearch(q, 5)).filter((r) => r.url?.includes("linkedin.com/in/"));
          cascadeBus.emit({ type: "query-result", subjectId: contact.id, query: q, index: qi, total: cascadeQueries.length, results: results.length });
          if (results.length > 0) break;
          await delay(500);
        }
        if (results.length > 0) {
          const domainHint = domainKw ? ` Email domain: "${domainKw}".` : "";
          const answer = await aiCall(
            `Find the PERSONAL LinkedIn profile of "${cleanName}" at "${cleanCompany}" in ${location}.${contact.title ? ` Title: "${contact.title}"` : ""}${domainHint}\nResults:\n${results.map((r, i) => `${i + 1}. ${r.url} - ${r.title}`).join("\n")}\nIf one matches, respond with ONLY the URL. If none, respond "NONE".`
          );
          if (answer && answer !== "NONE" && answer.includes("linkedin.com/in/")) {
            const m = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/);
            if (m) {
              const { error } = await insertPartnerSocialLink({ partner_id: partnerId, contact_id: contact.id, platform: "linkedin", url: m[1].replace(/\/$/, "") });
              if (!error) socialLinksFound++;
              const sr = extractSeniority(results[0]?.title);
              if (sr) contactProfiles[contact.id] = { name: contact.name, title: contact.title || "", ...sr };
              cascadeBus.emit({ type: "subject-done", subjectId: contact.id, matched: true });
            }
          } else {
            cascadeBus.emit({ type: "subject-done", subjectId: contact.id, matched: false });
          }
        } else {
          cascadeBus.emit({ type: "subject-done", subjectId: contact.id, matched: false });
        }
        await delay(800);
      }
      const waNumber = contact.mobile || contact.direct_phone;
      if (enableWhatsApp && waNumber && !existingSet.has(`${contact.id}_whatsapp`)) {
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
    if (!cfg("linkedinCompany", true)) return 0;
    if (existingSet.has("company_linkedin")) return 0;
    const cleanCo = cleanCompanyName(companyName);
    const q = `"${cleanCo}" site:linkedin.com/company`;
    cascadeBus.emit({ type: "query-start", subjectId: `company:${partnerId}`, query: q, index: 0, total: 1 });
    const res = await googleSearch(q, 3);
    const match = res.find((r) => r.url?.includes("linkedin.com/company/"));
    cascadeBus.emit({ type: "query-result", subjectId: `company:${partnerId}`, query: q, index: 0, total: 1, results: res.length });
    if (match) {
      const { error } = await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "linkedin", url: match.url.replace(/\/$/, "") });
      if (!error) { await delay(500); return 1; }
    }
    await delay(500);
    return 0;
  }, [googleSearch]);

  const scrapeWebsite = useCallback(async (website: string | null, partnerId: string, contacts?: Array<{ email?: string | null }>) => {
    if (!cfg("scrapeWebsite", true)) return { logoFound: false, websiteQualityScore: 0 };
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
    const partner = await getPartner(partnerId) as Record<string, unknown> | null;
    if (!partner) return { ...failResult, error: "Partner not found" };

    const contactsData = await findPartnerContacts(partnerId, "id, name, title, email, mobile, direct_phone");
    const contacts = contactsData ?? [];
    const existingLinksData = await findPartnerSocialLinks(partnerId);
    const existingSet = new Set((existingLinksData ?? []).map((l) => `${l.contact_id || "company"}_${l.platform}`));
    const location = `${partner.city || ""} ${partner.country_name || ""}`.trim();

    const { socialLinksFound: contactLinks, contactProfiles } = await searchLinkedInForContacts(contacts, partner.company_name as string, location, partnerId, existingSet);
    const companyLinks = await searchCompanyLinkedIn(partner.company_name as string, partnerId, existingSet);
    const { logoFound, websiteQualityScore } = await scrapeWebsite(partner.website as string | null, partnerId, contacts);

    // ============ NUOVE FONTI V2 (eseguite solo se abilitate) ============
    const extras: Record<string, unknown> = {};

    // 1) Google generale per ogni contatto (max 3 contatti per evitare rate limit)
    if (cfg("googleGeneral", false) && contacts.length > 0) {
      const mentionsByContact: Record<string, unknown[]> = {};
      for (const c of contacts.slice(0, 3)) {
        if (!c.name) continue;
        const m = await searchGoogleGeneral(fs, cleanPersonName(c.name), partner.company_name as string, googleSearch);
        if (m.length > 0) mentionsByContact[c.id] = m;
        await delay(800);
      }
      if (Object.keys(mentionsByContact).length > 0) extras.contact_mentions = mentionsByContact;
    }

    // 2) Google Maps / Place
    if (cfg("googleMaps", false)) {
      const gm = await scrapeGoogleMaps(fs, partner.company_name as string, (partner.city as string) || "", (partner.country_name as string) || "");
      if (gm) extras.google_maps = gm;
    }

    // 3) Sito multi-pagina (about/team/contacts)
    if (cfg("websiteMultiPage", false) && partner.website) {
      const wmp = await scrapeWebsiteSubpages(fs, partner.website as string);
      if (wmp.pagesScraped.length > 0) extras.website_multipage = wmp;
    }

    // 4) Reputation (Trustpilot + Wikipedia + News)
    if (cfg("reputation", false)) {
      const rep = await scrapeReputation(fs, partner.company_name as string, partner.website as string | null, googleSearch);
      // Salva solo se almeno una fonte ha prodotto risultati
      if (rep.trustpilot || rep.wikipedia || rep.news.length > 0) extras.reputation = rep;
    }

    const existing = (partner.enrichment_data as Record<string, unknown>) || {};
    const updated = {
      ...existing,
      ...(Object.keys(contactProfiles).length > 0 ? { contact_profiles: contactProfiles } : {}),
      ...(websiteQualityScore > 0 ? { website_quality_score: websiteQualityScore } : {}),
      ...extras,
      deep_search_at: new Date().toISOString(), deep_search_engine: "partner-connect-v3.4",
    };
    await updatePartner(partnerId, { enrichment_data: updated as unknown as Record<string, string> });

    const rating = await calculateRating(partnerId, websiteQualityScore, partner.website as string | null, partner.member_since as string | null, partner.branch_cities as string | null);
    await updatePartner(partnerId, { rating });

    return { success: true, socialLinksFound: contactLinks + companyLinks, logoFound, contactProfilesFound: Object.keys(contactProfiles).length, companyProfileFound: companyLinks > 0, rating, rateLimited: false, companyName: partner.company_name as string };
  }, [fs, googleSearch, scrapeUrl, searchLinkedInForContacts, searchCompanyLinkedIn, scrapeWebsite]);

  const searchContact = useCallback(async (contactId: string) => {
    const failResult = { success: false, socialLinksFound: 0, logoFound: false, contactProfilesFound: 0, companyProfileFound: false, rating: 0, rateLimited: false, companyName: "?" as string, error: undefined as string | undefined };
    const { getContactsByIds } = await import("@/data/contacts");
    const contacts = await getContactsByIds([contactId], "id, name, company_name, email, phone, mobile, country, city, position, enrichment_data") as Record<string, unknown>[];
    const contact = contacts[0] || null;
    const cErr = !contact ? "not found" : null;
    if (cErr || !contact) return { ...failResult, error: "Contact not found" };

    const s = (k: string) => String(contact[k] || "");
    const companyName = s("company_name") || "Unknown";
    const location = `${s("city")} ${s("country")}`.trim();
    let partnerId: string | null = null;
    if (s("company_name")) {
      const partner = await findPartnerByName(s("company_name"));
      partnerId = partner?.id || null;
    }
    let socialLinksFound = 0;
    const contactProfiles: Record<string, Record<string, string>> = {};

    const contactName = s("name");
    const contactEmail = s("email") || null;
    const contactPosition = s("position");
    if (cfg("linkedinContacts", true) && contactName && contactName.length >= 3) {
      const cleanName = cleanPersonName(contactName);
      const cleanCo = cleanCompanyName(companyName);
      const domainKw = (runtimeConfig.priorityDomain || "").trim() || extractDomainKeyword(contactEmail) || "";
      const lastName = getLastName(cleanName);
      const maxQ = Math.max(1, Math.min(5, cfg("maxQueriesPerContact", 5)));
      const cascadeQueries = [
        `"${cleanName}" "${cleanCo}" site:linkedin.com/in`,
        ...(domainKw ? [`"${cleanName}" "${domainKw}" site:linkedin.com/in`] : []),
        `"${cleanName}" site:linkedin.com/in`,
        ...(domainKw ? [`"${lastName}" "${domainKw}" site:linkedin.com/in`] : []),
        `${cleanName} ${cleanCo} LinkedIn`,
      ].slice(0, maxQ);
      let results: GoogleSearchResult[] = [];
      for (let qi = 0; qi < cascadeQueries.length; qi++) {
        const q = cascadeQueries[qi];
        cascadeBus.emit({ type: "query-start", subjectId: contactId, query: q, index: qi, total: cascadeQueries.length });
        results = (await googleSearch(q, 5)).filter((r) => r.url?.includes("linkedin.com/in/"));
        cascadeBus.emit({ type: "query-result", subjectId: contactId, query: q, index: qi, total: cascadeQueries.length, results: results.length });
        if (results.length > 0) break;
        await delay(500);
      }
      if (results.length > 0) {
        const domainHint = domainKw ? ` Email domain: "${domainKw}".` : "";
        const answer = await aiCall(
          `Find the PERSONAL LinkedIn profile of "${cleanName}" at "${cleanCo}" in ${location}.${contactPosition ? ` Title: "${contactPosition}"` : ""}${domainHint}\nResults:\n${results.map((r, i) => `${i + 1}. ${r.url} - ${r.title}`).join("\n")}\nIf one matches, respond with ONLY the URL. If none, respond "NONE".`
        );
        if (answer && answer !== "NONE" && answer.includes("linkedin.com/in/")) {
          const m = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/);
          if (m) {
            socialLinksFound++;
            const sr = extractSeniority(results[0]?.title);
            if (sr) contactProfiles[contactId] = { name: contactName, title: contactPosition, ...sr };
            if (partnerId) {
              await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "linkedin", url: m[1].replace(/\/$/, "") });
            }
            cascadeBus.emit({ type: "subject-done", subjectId: contactId, matched: true });
          }
        } else {
          cascadeBus.emit({ type: "subject-done", subjectId: contactId, matched: false });
        }
      } else {
        cascadeBus.emit({ type: "subject-done", subjectId: contactId, matched: false });
      }
      await delay(800);
    }

    const waNumber = s("mobile") || s("phone") || null;
    if (cfg("whatsapp", true) && waNumber) {
      const cleaned = toWhatsAppNumber(waNumber);
      if (cleaned.length >= 8) {
        socialLinksFound++;
        if (partnerId) await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "whatsapp", url: `https://wa.me/${cleaned}` });
      }
    }

    let companyProfileFound = false;
    if (cfg("linkedinCompany", true) && companyName !== "Unknown") {
      const cleanCo = cleanCompanyName(companyName);
      const q = `"${cleanCo}" site:linkedin.com/company`;
      cascadeBus.emit({ type: "query-start", subjectId: `company:${contactId}`, query: q, index: 0, total: 1 });
      const res = await googleSearch(q, 3);
      cascadeBus.emit({ type: "query-result", subjectId: `company:${contactId}`, query: q, index: 0, total: 1, results: res.length });
      const match = res.find((r) => r.url?.includes("linkedin.com/company/"));
      if (match) {
        companyProfileFound = true; socialLinksFound++;
        if (partnerId) await insertPartnerSocialLink({ partner_id: partnerId, contact_id: null, platform: "linkedin", url: match.url.replace(/\/$/, "") });
      }
      await delay(500);
    }

    let websiteUrl: string | null = null;
    if (contactEmail && !/(gmail|yahoo|hotmail|outlook|libero|alice|tin\.it)/i.test(contactEmail)) {
      const domain = contactEmail.split("@")[1];
      if (domain) websiteUrl = `https://${domain}`;
    }
    let logoFound = false;
    let websiteQualityScore = 0;
    if (cfg("scrapeWebsite", true) && websiteUrl) {
      const scraped = await scrapeUrl(websiteUrl);
      if (scraped) {
        try { const domain = new URL(websiteUrl).hostname; if (`https://www.google.com/s2/favicons?domain=${domain}&sz=128`) logoFound = true; } catch { /* best-effort */ }
        if (scraped.markdown && scraped.markdown.length > 100) {
          const qa = await aiCall(`Rate this company website 1-5 for: design, content, professionalism, business quality. Respond with ONLY a number.\n\n${scraped.markdown.slice(0, 2000)}`);
          if (qa) { const parsed = parseInt(qa.replace(/[^1-5]/g, "")); if (parsed >= 1 && parsed <= 5) websiteQualityScore = parsed; }
        }
      }
    }

    const existing = (contact["enrichment_data"] as Record<string, unknown>) || {};
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

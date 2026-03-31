/**
 * useDeepSearchLocal — Client-side Deep Search using Partner Connect extension + AI Gateway
 * Uses Partner Connect's agent sequences for Google search and scraping.
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

async function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

interface GoogleSearchResult {
  url: string;
  title: string;
  snippet: string;
}

export function useDeepSearchLocal() {
  const fs = useFireScrapeExtensionBridge();

  /**
   * Perform a Google search using Partner Connect's agent sequence.
   * Opens Google in a background tab, extracts results.
   */
  const googleSearch = useCallback(async (query: string, limit = 5): Promise<GoogleSearchResult[]> => {
    // Use agent-sequence: navigate to Google, then extract results
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${limit}&hl=en`;

    // Navigate to Google search
    const navResult = await fs.agentAction({ action: "navigate", url: searchUrl });
    if (!navResult.success) return [];

    await delay(2000);

    // Extract search results using CSS selectors
    const extractResult = await fs.extract({
      results_links: "div.g a[href^='http'] h3",
      results_urls: "div.g a[href^='http']",
      results_snippets: "div.g div.VwiC3b, div.g span.aCOpRe",
    });

    if (!extractResult.success || !extractResult.data) return [];

    // Parse results
    const titles = Array.isArray(extractResult.data.results_links)
      ? extractResult.data.results_links
      : extractResult.data.results_links ? [extractResult.data.results_links] : [];
    const urls = Array.isArray(extractResult.data.results_urls)
      ? extractResult.data.results_urls
      : extractResult.data.results_urls ? [extractResult.data.results_urls] : [];
    const snippets = Array.isArray(extractResult.data.results_snippets)
      ? extractResult.data.results_snippets
      : extractResult.data.results_snippets ? [extractResult.data.results_snippets] : [];

    const results: GoogleSearchResult[] = [];
    for (let i = 0; i < Math.min(titles.length, limit); i++) {
      results.push({
        url: urls[i] || "",
        title: titles[i] || "",
        snippet: snippets[i] || "",
      });
    }
    return results;
  }, [fs]);

  /**
   * Scrape a URL using Partner Connect — navigate then scrape.
   */
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

  /**
   * Run Deep Search for a single partner entirely client-side.
   */
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

    const { data: contacts = [] } = await supabase
      .from("partner_contacts")
      .select("id, name, title, email, mobile, direct_phone")
      .eq("partner_id", partnerId);

    const { data: existingLinks = [] } = await supabase
      .from("partner_social_links")
      .select("contact_id, platform")
      .eq("partner_id", partnerId);

    const { data: networks = [] } = await supabase
      .from("partner_networks")
      .select("network_name")
      .eq("partner_id", partnerId);

    const existingSet = new Set(existingLinks.map((l) => `${l.contact_id || "company"}_${l.platform}`));

    let socialLinksFound = 0;
    let logoFound = false;
    const contactProfiles: Record<string, any> = {};

    // ═══ SEARCH SOCIAL PROFILES ═══
    for (const contact of contacts || []) {
      if (!contact.name || contact.name.length < 3) continue;
      const location = `${partner.city || ""} ${partner.country_name || ""}`.trim();

      // --- LinkedIn ---
      if (!existingSet.has(`${contact.id}_linkedin`)) {
        const query = `"${contact.name}" "${partner.company_name}" site:linkedin.com/in`;
        let results = (await googleSearch(query, 5)).filter((r) => r.url?.includes("linkedin.com/in/"));

        if (results.length === 0) {
          const retry = `"${getLastName(contact.name)}" "${partner.company_name}" logistics site:linkedin.com/in`;
          results = (await googleSearch(retry, 5)).filter((r) => r.url?.includes("linkedin.com/in/"));
          await delay(500);
        }

        if (results.length > 0 && apiKey) {
          const answer = await aiCall(
            `Find the PERSONAL LinkedIn profile of "${contact.name}" at "${partner.company_name}" in ${location}.${contact.title ? ` Title: "${contact.title}"` : ""}
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

      // --- Facebook ---
      if (!existingSet.has(`${contact.id}_facebook`)) {
        const q = `"${contact.name}" "${partner.company_name}" site:facebook.com`;
        const fbRes = (await googleSearch(q, 5)).filter((r) => r.url?.includes("facebook.com/") && !r.url?.includes("/groups/"));
        if (fbRes.length > 0 && apiKey) {
          const answer = await aiCall(
            `Find the PERSONAL Facebook profile of "${contact.name}" at "${partner.company_name}" in ${location}.
Results:\n${fbRes.map((r, i) => `${i + 1}. ${r.url} - ${r.title}`).join("\n")}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
            apiKey
          );
          if (answer && answer !== "NONE" && answer.includes("facebook.com")) {
            const m = answer.match(/(https?:\/\/[^\s"<>]+facebook\.com[^\s"<>]*)/);
            if (m) {
              const { error } = await supabase.from("partner_social_links").insert({
                partner_id: partnerId, contact_id: contact.id, platform: "facebook", url: m[1].replace(/\/$/, ""),
              });
              if (!error) socialLinksFound++;
            }
          }
        }
        await delay(800);
      }

      // --- Instagram ---
      if (!existingSet.has(`${contact.id}_instagram`)) {
        const q = `"${contact.name}" "${partner.company_name}" site:instagram.com`;
        const igRes = (await googleSearch(q, 5)).filter((r) => r.url?.includes("instagram.com/"));
        if (igRes.length > 0 && apiKey) {
          const answer = await aiCall(
            `Find the Instagram profile of "${contact.name}" at "${partner.company_name}" in ${location}.
Results:\n${igRes.map((r, i) => `${i + 1}. ${r.url} - ${r.title}`).join("\n")}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
            apiKey
          );
          if (answer && answer !== "NONE" && answer.includes("instagram.com")) {
            const m = answer.match(/(https?:\/\/[^\s"<>]+instagram\.com[^\s"<>]*)/);
            if (m) {
              const { error } = await supabase.from("partner_social_links").insert({
                partner_id: partnerId, contact_id: contact.id, platform: "instagram", url: m[1].replace(/\/$/, ""),
              });
              if (!error) socialLinksFound++;
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

    // ═══ COMPANY LINKEDIN ═══
    if (!existingSet.has("company_linkedin")) {
      const q = `"${partner.company_name}" site:linkedin.com/company`;
      const res = await googleSearch(q, 3);
      const match = res.find((r) => r.url?.includes("linkedin.com/company/"));
      if (match) {
        const { error } = await supabase.from("partner_social_links").insert({
          partner_id: partnerId, contact_id: null, platform: "linkedin", url: match.url.replace(/\/$/, ""),
        });
        if (!error) socialLinksFound++;
      }
      await delay(500);
    }

    // ═══ WEBSITE + LOGO via Partner Connect scrape ═══
    let websiteQualityScore = 0;
    if (partner.website) {
      const websiteUrl = partner.website.startsWith("http") ? partner.website : `https://${partner.website}`;
      const scraped = await scrapeUrl(websiteUrl);
      if (scraped) {
        // Try Google favicon
        let logoUrl: string | null = null;
        try {
          const domain = new URL(websiteUrl).hostname;
          logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        } catch {}

        if (logoUrl) {
          const { error } = await supabase.from("partners").update({ logo_url: logoUrl }).eq("id", partnerId);
          if (!error) logoFound = true;
        }

        // Website quality via AI
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
    } else {
      const ce = contacts?.find((c) => c.email && !/(gmail|yahoo|hotmail|outlook)/i.test(c.email));
      if (ce?.email) {
        const domain = ce.email.split("@")[1];
        if (domain) await supabase.from("partners").update({ website: `https://${domain}` }).eq("id", partnerId);
      }
    }

    // ═══ SAVE ENRICHMENT ═══
    const existing = (partner.enrichment_data as any) || {};
    const updated = {
      ...existing,
      ...(Object.keys(contactProfiles).length > 0 ? { contact_profiles: contactProfiles } : {}),
      ...(websiteQualityScore > 0 ? { website_quality_score: websiteQualityScore } : {}),
      deep_search_at: new Date().toISOString(),
      deep_search_engine: "firescrape-v3.3",
    };
    await supabase.from("partners").update({ enrichment_data: updated }).eq("id", partnerId);

    // ═══ RATING ═══
    const { data: services = [] } = await supabase
      .from("partner_services")
      .select("service_category")
      .eq("partner_id", partnerId);

    const websiteScore = websiteQualityScore || (partner.website ? 2 : 1);
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
    if (partner.member_since) {
      const years = (Date.now() - new Date(partner.member_since).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (years >= 20) seniorityScore = 5;
      else if (years >= 10) seniorityScore = 3;
      else if (years >= 5) seniorityScore = 2;
    }

    const branchCities = Array.isArray(partner.branch_cities) ? partner.branch_cities : [];
    let internationalScore = 1;
    if (branchCities.length >= 10) internationalScore = 5;
    else if (branchCities.length >= 3) internationalScore = 3;
    else if (branchCities.length >= 1) internationalScore = 2;

    const rawRating = websiteScore * 0.2 + serviceMix * 0.2 + networkScore * 0.15 + seniorityScore * 0.15 + internationalScore * 0.1 + 1 * 0.1 + 1 * 0.1;
    const rating = Math.min(5, Math.max(1, Math.round(rawRating * 2) / 2));

    await supabase.from("partners").update({ rating }).eq("id", partnerId);

    return {
      success: true,
      socialLinksFound,
      logoFound,
      contactProfilesFound: Object.keys(contactProfiles).length,
      companyProfileFound: false,
      rating,
      rateLimited: false,
      companyName: partner.company_name,
    };
  }, [fs, googleSearch, scrapeUrl]);

  return { searchPartner, isAvailable: fs.isAvailable };
}

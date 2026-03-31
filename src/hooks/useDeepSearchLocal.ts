/**
 * useDeepSearchLocal — Client-side Deep Search using FireScrape extension + AI Gateway
 * Replaces Firecrawl API calls with browser-based Google searches and scraping.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFireScrapeExtensionBridge, FireScrapeSearchResult } from "./useFireScrapeExtensionBridge";

// Lovable AI Gateway (same endpoint used by edge functions)
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash-lite";

async function getApiKey(): Promise<string | null> {
  // The LOVABLE_API_KEY is available as env var on the server
  // For client-side, we call a tiny edge function to proxy the AI call
  // OR we use the VITE env if available
  return import.meta.env.VITE_LOVABLE_API_KEY || null;
}

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

export function useDeepSearchLocal() {
  const fs = useFireScrapeExtensionBridge();

  /**
   * Run Deep Search for a single partner entirely client-side.
   * Returns the same shape as the edge function response.
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
    // We need the AI key — try to get from edge function proxy
    const apiKey = await getApiKey();

    // Get partner data
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

    const { data: certifications = [] } = await supabase
      .from("partner_certifications")
      .select("certification")
      .eq("partner_id", partnerId);

    const existingSet = new Set(existingLinks.map((l) => `${l.contact_id || "company"}_${l.platform}`));

    let socialLinksFound = 0;
    let logoFound = false;
    const contactProfiles: Record<string, any> = {};

    // ═══ SEARCH SOCIAL PROFILES FOR EACH CONTACT ═══
    for (const contact of contacts || []) {
      if (!contact.name || contact.name.length < 3) continue;
      const location = `${partner.city || ""} ${partner.country_name || ""}`.trim();

      // --- LinkedIn personal ---
      if (!existingSet.has(`${contact.id}_linkedin`)) {
        const query = `"${contact.name}" "${partner.company_name}" site:linkedin.com/in`;
        let results = (await fs.search(query, 5)).results?.filter((r) => r.url?.includes("linkedin.com/in/")) || [];

        if (results.length === 0) {
          const retry = `"${getLastName(contact.name)}" "${partner.company_name}" logistics site:linkedin.com/in`;
          results = (await fs.search(retry, 5)).results?.filter((r) => r.url?.includes("linkedin.com/in/")) || [];
          await delay(500);
        }

        if (results.length > 0 && apiKey) {
          const answer = await aiCall(
            `Find the PERSONAL LinkedIn profile (linkedin.com/in/) of "${contact.name}" at "${partner.company_name}" in ${location}.${contact.title ? ` Title: "${contact.title}"` : ""}
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
              if (sr) contactProfiles[contact.id] = { ...contactProfiles[contact.id], name: contact.name, title: contact.title, ...sr };
            }
          }
        }
        await delay(800);
      }

      // --- Facebook ---
      if (!existingSet.has(`${contact.id}_facebook`)) {
        const q = `"${contact.name}" "${partner.company_name}" site:facebook.com`;
        const fbRes = (await fs.search(q, 5)).results?.filter((r) => r.url?.includes("facebook.com/") && !r.url?.includes("/groups/")) || [];
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
        const igRes = (await fs.search(q, 5)).results?.filter((r) => r.url?.includes("instagram.com/")) || [];
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
      const res = (await fs.search(q, 3)).results || [];
      const match = res.find((r) => r.url?.includes("linkedin.com/company/"));
      if (match) {
        const { error } = await supabase.from("partner_social_links").insert({
          partner_id: partnerId, contact_id: null, platform: "linkedin", url: match.url.replace(/\/$/, ""),
        });
        if (!error) socialLinksFound++;
      }
      await delay(500);
    }

    // ═══ WEBSITE + LOGO via scrape ═══
    let websiteQualityScore = 0;
    if (partner.website) {
      const websiteUrl = partner.website.startsWith("http") ? partner.website : `https://${partner.website}`;
      const scrapeResult = await fs.scrape(websiteUrl);
      if (scrapeResult.success && scrapeResult.data) {
        let logoUrl = scrapeResult.data.logoUrl;
        if (!logoUrl) {
          try {
            const domain = new URL(websiteUrl).hostname;
            logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          } catch {}
        }
        if (logoUrl) {
          const { error } = await supabase.from("partners").update({ logo_url: logoUrl }).eq("id", partnerId);
          if (!error) logoFound = true;
        }

        // Website quality via AI
        if (scrapeResult.data.markdown && scrapeResult.data.markdown.length > 100 && apiKey) {
          const qa = await aiCall(
            `Rate this logistics company website 1-5 for: design, content, professionalism, business quality. Respond with ONLY a number.\n\n${scrapeResult.data.markdown.slice(0, 2000)}`,
            apiKey
          );
          if (qa) {
            const parsed = parseInt(qa.replace(/[^1-5]/g, ""));
            if (parsed >= 1 && parsed <= 5) websiteQualityScore = parsed;
          }
        }
      }
    } else {
      // Try email domain
      const ce = contacts?.find((c) => c.email && !/(gmail|yahoo|hotmail|outlook)/i.test(c.email));
      if (ce?.email) {
        const domain = ce.email.split("@")[1];
        if (domain) {
          await supabase.from("partners").update({ website: `https://${domain}` }).eq("id", partnerId);
        }
      }
    }

    // ═══ SAVE ENRICHMENT ═══
    const existing = (partner.enrichment_data as any) || {};
    const updated = {
      ...existing,
      ...(Object.keys(contactProfiles).length > 0 ? { contact_profiles: contactProfiles } : {}),
      ...(websiteQualityScore > 0 ? { website_quality_score: websiteQualityScore } : {}),
      deep_search_at: new Date().toISOString(),
      deep_search_engine: "firescrape",
    };
    await supabase.from("partners").update({ enrichment_data: updated }).eq("id", partnerId);

    // ═══ RATING (simplified — same weights) ═══
    const { data: services = [] } = await supabase
      .from("partner_services")
      .select("service_category")
      .eq("partner_id", partnerId);

    const websiteScore = websiteQualityScore || (partner.website ? 2 : 1);
    const svcSet = new Set(services.map((s: any) => s.service_category));
    let serviceMix = 1;
    if (svcSet.has("ocean_fcl") || svcSet.has("ocean_lcl")) serviceMix = 1;
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
  }, [fs]);

  return { searchPartner, isAvailable: fs.isAvailable };
}

/**
 * ai-arena-suggest/index.ts — Suggests never-contacted partners for the AI Arena.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { aiChat } from "../_shared/aiGateway.ts";
import { detectRecipientLanguage } from "../_shared/languageDetector.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const _userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const focus = body.focus || "tutti";
    const preferredChannel = body.preferred_channel || "email";
    const sendLanguage = body.send_language || "recipient";
    const batchSize = Math.min(Math.max(Number(body.batch_size) || 1, 1), 10);
    const excludedIds: string[] = body.excluded_ids || [];

    // Build query for never-contacted partners
    let query = supabase
      .from("partners")
      .select("id, company_name, company_alias, country_code, country_name, city, email, phone, rating, enrichment_data, profile_description")
      .not("email", "is", null);

    if (focus === "italia") query = query.eq("country_code", "IT");
    else if (focus === "estero") query = query.neq("country_code", "IT");

    if (excludedIds.length > 0) {
      // Filter out excluded IDs - limit to first 100 to avoid query issues
      for (const id of excludedIds.slice(0, 100)) {
        query = query.neq("id", id);
      }
    }

    query = query.order("rating", { ascending: false, nullsFirst: false }).limit(batchSize * 3);

    const { data: candidates, error: queryError } = await query;
    if (queryError) return json({ error: queryError.message }, 500);

    if (!candidates || candidates.length === 0) {
      return json({ suggestions: [], message: "Nessun contatto disponibile con i filtri selezionati." });
    }

    // Filter out partners that already have outreach activities
    const candidateIds = candidates.map((c: Record<string, unknown>) => c.id as string);
    const { data: existingActivities } = await supabase
      .from("activities")
      .select("partner_id")
      .in("partner_id", candidateIds)
      .in("activity_type", ["send_email", "email", "outreach", "linkedin_message", "whatsapp"]);

    const contactedSet = new Set((existingActivities || []).map((a: Record<string, unknown>) => a.partner_id));
    const neverContacted = candidates.filter((c: Record<string, unknown>) => !contactedSet.has(c.id as string)).slice(0, batchSize);

    if (neverContacted.length === 0) {
      return json({ suggestions: [], message: "Tutti i partner disponibili sono già stati contattati." });
    }

    // Load contacts for each partner
    const partnerIds = neverContacted.map((p: Record<string, unknown>) => p.id as string);
    const { data: contacts } = await supabase
      .from("partner_contacts")
      .select("partner_id, name, contact_alias, title, email, direct_phone, mobile, is_primary")
      .in("partner_id", partnerIds);

    const contactMap: Record<string, Record<string, unknown>> = {};
    for (const c of (contacts || []) as Record<string, unknown>[]) {
      const pid = c.partner_id as string;
      if (!contactMap[pid] || c.is_primary) contactMap[pid] = c;
    }

    // Generate suggestions with AI reasoning
    const suggestions = [];
    for (const partner of neverContacted as Record<string, unknown>[]) {
      const contact = contactMap[partner.id as string] || null;
      const countryCode = (partner.country_code as string) || "US";
      const langInfo = detectRecipientLanguage(countryCode);

      let targetLanguage = langInfo.language;
      let languageLabel = langInfo.label;
      if (sendLanguage === "english") { targetLanguage = "English"; languageLabel = "Inglese"; }
      else if (sendLanguage === "italian") { targetLanguage = "Italiano"; languageLabel = "Italiano"; }

      const contactName = contact ? ((contact.contact_alias || contact.name) as string) : null;
      const contactEmail = contact?.email as string || partner.email as string;

      // Generate reasoning
      let aiReasoning = "";
      try {
        const reasonResult = await aiChat({
          models: ["google/gemini-2.5-flash-lite"],
          messages: [{
            role: "user",
            content: `In ONE sentence in Italian, explain why a freight forwarding company should reach out to "${partner.company_name}" in ${partner.country_name || countryCode}${partner.profile_description ? `. Company profile: ${(partner.profile_description as string).substring(0, 300)}` : ""}${partner.rating ? `. Rating: ${partner.rating}/5` : ""}. Focus on business opportunity.`
          }],
          timeoutMs: 10000, maxRetries: 0, context: "arena-reason",
        });
        aiReasoning = reasonResult.content?.trim() || "Partner mai contattato — opportunità di primo contatto.";
      } catch {
        aiReasoning = "Partner mai contattato — opportunità di primo contatto.";
      }

      // Generate draft email
      let draftSubject = "";
      let draftBody = "";
      try {
        const draftResult = await aiChat({
          models: ["google/gemini-2.5-flash"],
          messages: [
            {
              role: "system",
              content: `You are a B2B logistics sales expert. Write a short outreach email in ${targetLanguage}. First line MUST be "Subject: <subject>". Then a blank line, then the HTML body. Keep it under 150 words. Professional, warm, specific to freight forwarding partnership.`
            },
            {
              role: "user",
              content: `Write an outreach email to ${contactName || "the team"} at ${partner.company_name} (${partner.country_name || countryCode}${partner.city ? `, ${partner.city}` : ""}). Goal: propose freight forwarding partnership. Language: ${targetLanguage}.`
            }
          ],
          timeoutMs: 15000, maxRetries: 1, context: "arena-draft",
        });

        const content = draftResult.content || "";
        const subjectMatch = content.match(/^Subject:\s*(.+)$/m);
        draftSubject = subjectMatch ? subjectMatch[1].trim() : "Partnership Proposal";
        draftBody = content.replace(/^Subject:.*\n\n?/m, "").trim();
      } catch {
        draftSubject = "Partnership Proposal";
        draftBody = "<p>Draft generation failed — please compose manually.</p>";
      }

      suggestions.push({
        partner_id: partner.id,
        company_name: partner.company_name,
        company_alias: partner.company_alias,
        contact_name: contactName,
        contact_position: contact?.title || null,
        country_code: countryCode,
        country_name: partner.country_name,
        city: partner.city,
        email: contactEmail,
        phone: contact?.direct_phone || contact?.mobile || partner.phone,
        rating: partner.rating,
        employee_count: (partner.enrichment_data as Record<string, unknown>)?.employee_count ?? null,
        detected_language: langInfo.language,
        language_label: languageLabel,
        target_language: targetLanguage,
        ai_reasoning: aiReasoning,
        draft_subject: draftSubject,
        draft_body: draftBody,
        partner_match: true,
        channel: preferredChannel,
      });
    }

    // Get total never-contacted count
    const { count: totalNeverContacted } = await supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null);

    return json({
      suggestions,
      total_available: totalNeverContacted || 0,
      batch_size: batchSize,
    });
  } catch (e: unknown) {
    console.error("ai-arena-suggest error:", e);
    return edgeError(extractErrorMessage(e), 500, cors);
  }
});

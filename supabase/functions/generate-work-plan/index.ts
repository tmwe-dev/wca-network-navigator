import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // === ANALYSIS 1: WCA Partners ===
    const { data: partnerStats } = await supabase.rpc("generate_work_plan_partner_stats", { p_user_id: userId });

    // Fallback: direct queries if RPC doesn't exist
    const { count: totalPartnersWithEmail } = await supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null);

    const { data: neverContactedPartners } = await supabase
      .from("partners")
      .select("id, country_code, country_name, company_name, email")
      .not("email", "is", null)
      .eq("interaction_count", 0)
      .limit(1000);

    const neverContactedCount = neverContactedPartners?.length ?? 0;

    // Partners by country (never contacted)
    const countryMap: Record<string, { country: string; never_contacted: number; total: number }> = {};
    neverContactedPartners?.forEach((p: any) => {
      const cc = p.country_code || "XX";
      if (!countryMap[cc]) {
        countryMap[cc] = { country: p.country_name || cc, never_contacted: 0, total: 0 };
      }
      countryMap[cc].never_contacted++;
      countryMap[cc].total++;
    });

    // Stale partners (>90 days since last interaction)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { count: staleCount } = await supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null)
      .lt("last_interaction_at", ninetyDaysAgo)
      .gt("interaction_count", 0);

    // Positive responses without follow-up
    const { data: positiveClassifications } = await supabase
      .from("email_classifications")
      .select("id, email_address, partner_id")
      .eq("direction", "inbound")
      .in("category", ["interested", "positive", "meeting_request"])
      .limit(500);

    const positiveNoFollowup = positiveClassifications?.length ?? 0;

    // === ANALYSIS 2: CRM Contacts ===
    const { count: totalContacts } = await supabase
      .from("imported_contacts")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null);

    const { count: contactsNeverContacted } = await supabase
      .from("imported_contacts")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null)
      .eq("interaction_count", 0);

    const { count: unmatchedContacts } = await supabase
      .from("imported_contacts")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null)
      .is("wca_partner_id", null);

    // === ANALYSIS 3: Business Cards ===
    const { count: totalCards } = await supabase
      .from("business_cards")
      .select("id", { count: "exact", head: true });

    const { count: cardsWithEmail } = await supabase
      .from("business_cards")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null);

    // Recent events (< 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentCards } = await supabase
      .from("business_cards")
      .select("id, email, event_name, met_at, contact_name, company_name")
      .not("email", "is", null)
      .gte("met_at", thirtyDaysAgo)
      .eq("lead_status", "new")
      .limit(500);

    // Group BCA by event
    const eventMap: Record<string, { event: string; total: number; date: string }> = {};
    recentCards?.forEach((c: any) => {
      const ev = c.event_name || "Senza evento";
      if (!eventMap[ev]) {
        eventMap[ev] = { event: ev, total: 0, date: c.met_at || "" };
      }
      eventMap[ev].total++;
    });

    // === GENERATE PLANS ===
    const plans: any[] = [];
    let priority = 1;

    // Plan 1: Recent BCA events (highest priority)
    for (const [eventName, info] of Object.entries(eventMap)) {
      if (info.total > 0 && eventName !== "Senza evento") {
        plans.push({
          priority: priority++,
          title: `Follow-up BCA evento ${eventName} (${info.total} contatti)`,
          description: `Biglietti da visita raccolti a ${eventName}, non ancora contattati`,
          source_type: "business_cards",
          goal: "event_followup",
          recommended_template: "Follow-Up Biglietti da Visita",
          contact_count: info.total,
          urgency: "alta",
          filter: { event_name: eventName },
          reason: "Evento recente, contatto caldo, rischio raffreddamento",
        });
      }
    }

    // Plan 2: Positive responses without follow-up
    if (positiveNoFollowup > 0) {
      plans.push({
        priority: priority++,
        title: `Follow-up risposte positive (${positiveNoFollowup} contatti)`,
        description: "Contatti che hanno risposto positivamente ma non hanno ricevuto follow-up",
        source_type: "mixed",
        goal: "follow_up",
        recommended_template: "Follow-Up Post Risposta",
        contact_count: positiveNoFollowup,
        urgency: "alta",
        reason: "Risposte positive non gestite — opportunità in corso",
      });
    }

    // Plan 3: WCA Partners by country (top 5 countries)
    const topCountries = Object.entries(countryMap)
      .sort((a, b) => b[1].never_contacted - a[1].never_contacted)
      .slice(0, 5);

    for (const [cc, info] of topCountries) {
      if (info.never_contacted > 0) {
        plans.push({
          priority: priority++,
          title: `Primo contatto WCA Partner ${info.country} (${info.never_contacted} aziende)`,
          description: `Partner WCA in ${info.country} mai contattati con email disponibile`,
          source_type: "wca_partners",
          goal: "primo_contatto",
          recommended_template: "Primo Contatto WCA Partner",
          contact_count: info.never_contacted,
          urgency: "media",
          filter: { country_code: cc },
          reason: `${info.country} ha ${info.never_contacted} partner mai contattati, mercato strategico`,
        });
      }
    }

    // Plan 4: Stale partner reactivation
    if ((staleCount ?? 0) > 0) {
      plans.push({
        priority: priority++,
        title: `Riattivazione partner inattivi (${staleCount} partner)`,
        description: "Partner con ultima interazione oltre 90 giorni fa",
        source_type: "wca_partners",
        goal: "reactivation",
        recommended_template: "Riattivazione Partner Inattivi",
        contact_count: staleCount ?? 0,
        urgency: "bassa",
        reason: "Relazioni da riattivare prima che diventino fredde",
      });
    }

    // Plan 5: Unmatched CRM contacts
    if ((unmatchedContacts ?? 0) > 0) {
      plans.push({
        priority: priority++,
        title: `Contatti CRM non collegati (${unmatchedContacts} contatti)`,
        description: "Contatti importati con email ma non collegati a nessun partner",
        source_type: "contacts",
        goal: "primo_contatto",
        recommended_template: "Primo Contatto WCA Partner",
        contact_count: unmatchedContacts ?? 0,
        urgency: "bassa",
        reason: "Potenziale non sfruttato nel CRM",
      });
    }

    // BCA without event (lower priority)
    const noEventCards = eventMap["Senza evento"];
    if (noEventCards && noEventCards.total > 0) {
      plans.push({
        priority: priority++,
        title: `Biglietti da visita senza evento (${noEventCards.total} contatti)`,
        description: "Biglietti da visita con email ma senza evento associato",
        source_type: "business_cards",
        goal: "primo_contatto",
        recommended_template: "Follow-Up Biglietti da Visita",
        contact_count: noEventCards.total,
        urgency: "bassa",
        filter: { event_name: null },
        reason: "Contatti raccolti da gestire",
      });
    }

    const result = {
      generated_at: new Date().toISOString(),
      summary: {
        total_actionable: plans.reduce((s, p) => s + p.contact_count, 0),
        total_never_contacted: neverContactedCount + (contactsNeverContacted ?? 0),
        urgent_followups: positiveNoFollowup + (recentCards?.length ?? 0),
        stale_reactivations: staleCount ?? 0,
      },
      plans,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const body = await req.json().catch(() => ({}));
    const countryCode = body.countryCode || null;

    const extUrl = "https://dlldkrzoxvjxpgkkttxu.supabase.co";
    const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY");
    if (!extKey) {
      return new Response(
        JSON.stringify({ error: "WCA_EXTERNAL_SUPABASE_KEY not configured" }),
        { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }

    const localUrl = Deno.env.get("SUPABASE_URL")!;
    const localServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }
    const anonSb = createClient(localUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonSb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }

    const extSb = createClient(extUrl, extKey);
    const localSb = createClient(localUrl, localServiceKey);

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Count total
          let countQuery = extSb
            .from("wca_profiles")
            .select("*", { count: "exact", head: true });
          if (countryCode) countQuery = countQuery.eq("country_code", countryCode);
          const { count: totalCount, error: countErr } = await countQuery;

          if (countErr) {
            send({ type: "error", message: countErr.message });
            controller.close();
            return;
          }

          send({ type: "start", total: totalCount || 0, countryCode });

          if (!totalCount || totalCount === 0) {
            send({ type: "complete", synced: 0, contacts: 0, networks: 0 });
            controller.close();
            return;
          }

          let synced = 0;
          let contactsSynced = 0;
          let networksSynced = 0;
          const pageSize = 1000;
          const totalPages = Math.ceil(totalCount / pageSize);

          for (let page = 0; page < totalPages; page++) {
            // Fetch from external wca_profiles
            let fetchQuery = extSb.from("wca_profiles").select("*");
            if (countryCode) fetchQuery = fetchQuery.eq("country_code", countryCode);
            const { data: extPartners, error: fetchErr } = await fetchQuery
              .order("wca_id", { ascending: true })
              .range(page * pageSize, (page + 1) * pageSize - 1);

            if (fetchErr) {
              send({ type: "error", message: `Page ${page}: ${fetchErr.message}` });
              continue;
            }

            if (!extPartners || extPartners.length === 0) break;

            // Map to local partners schema
            const partnerRows = extPartners.map((p: any) => ({
              wca_id: p.wca_id,
              company_name: p.company_name,
              country_code: p.country_code,
              country_name: p.country_name || p.country_code || "Unknown",
              city: p.city || "",
              address: p.address || null,
              phone: p.phone || null,
              fax: p.fax || null,
              mobile: null,
              emergency_phone: p.emergency_call || null,
              email: p.email || null,
              website: p.website || null,
              profile_description: p.profile_text || null,
              logo_url: p.logo_url || null,
              raw_profile_html: null,
              raw_profile_markdown: null,
              company_alias: null,
              office_type: p.branch?.includes("Head Office") ? "head_office" : "branch",
              member_since: p.member_since || null,
              membership_expires: p.expires || null,
              has_branches: (p.branch_cities && p.branch_cities.length > 1) || false,
              branch_cities: p.branch_cities || [],
              partner_type: "freight_forwarder",
              is_active: true,
              rating: null,
              rating_details: null,
              enrichment_data: null,
              enriched_at: null,
              ai_parsed_at: null,
            }));

            // Upsert partners
            const { error: upsertErr } = await localSb
              .from("partners")
              .upsert(partnerRows, { onConflict: "wca_id" });

            if (upsertErr) {
              send({ type: "error", message: `Upsert page ${page}: ${upsertErr.message}` });
              continue;
            }

            synced += extPartners.length;

            // Get local partner IDs
            const wcaIds = extPartners.map((p: any) => p.wca_id).filter(Boolean);
            const { data: localPartners } = await localSb
              .from("partners")
              .select("id, wca_id")
              .in("wca_id", wcaIds);

            const wcaToLocalId = new Map<number, string>();
            if (localPartners) {
              for (const lp of localPartners) {
                if (lp.wca_id) wcaToLocalId.set(lp.wca_id, lp.id);
              }
            }

            // Batch collect all contacts and networks for this page
            const allContacts: any[] = [];
            const allNetworks: any[] = [];
            const partnerIdsWithContacts: string[] = [];
            const partnerIdsWithNetworks: string[] = [];

            for (const extP of extPartners) {
              const localId = wcaToLocalId.get(extP.wca_id);
              if (!localId) continue;

              const extContacts = extP.contacts || [];
              if (extContacts.length > 0) {
                partnerIdsWithContacts.push(localId);
                for (const c of extContacts) {
                  allContacts.push({
                    partner_id: localId,
                    name: c.name || "Unknown",
                    title: c.title || null,
                    email: c.email || null,
                    direct_phone: c.direct_phone || c.direct_line || c.phone || null,
                    mobile: c.mobile || null,
                    is_primary: c.is_primary || false,
                    contact_alias: c.contact_alias || null,
                  });
                }
              }

              const extNetworks = extP.networks || [];
              if (extNetworks.length > 0) {
                partnerIdsWithNetworks.push(localId);
                for (const n of extNetworks) {
                  allNetworks.push({
                    partner_id: localId,
                    network_name: typeof n === "string" ? n : (n.network_name || n.name || "Unknown"),
                    network_id: typeof n === "object" ? (n.network_id || null) : null,
                    expires: typeof n === "object" ? (n.expires || null) : null,
                  });
                }
              }
            }

            // Batch delete + insert contacts
            if (partnerIdsWithContacts.length > 0) {
              await localSb
                .from("partner_contacts")
                .delete()
                .in("partner_id", partnerIdsWithContacts);

              // Insert in chunks of 500
              for (let i = 0; i < allContacts.length; i += 500) {
                const chunk = allContacts.slice(i, i + 500);
                const { error: cErr } = await localSb.from("partner_contacts").insert(chunk);
                if (!cErr) contactsSynced += chunk.length;
              }
            }

            // Batch delete + insert networks
            if (partnerIdsWithNetworks.length > 0) {
              await localSb
                .from("partner_networks")
                .delete()
                .in("partner_id", partnerIdsWithNetworks);

              for (let i = 0; i < allNetworks.length; i += 500) {
                const chunk = allNetworks.slice(i, i + 500);
                const { error: nErr } = await localSb.from("partner_networks").insert(chunk);
                if (!nErr) networksSynced += chunk.length;
              }
            }

            send({
              type: "progress",
              synced,
              total: totalCount,
              contacts: contactsSynced,
              networks: networksSynced,
              page: page + 1,
              totalPages,
            });
          }

          send({ type: "complete", synced, contacts: contactsSynced, networks: networksSynced });
        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...dynCors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});

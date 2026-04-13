import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";


Deno.serve(async (req: Request) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const contactIds: string[] = body.contactIds || [];

    if (contactIds.length < 2) {
      return new Response(JSON.stringify({ error: "Seleziona almeno 2 contatti" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Fetch selected contacts
    const { data: contacts, error: fetchErr } = await admin
      .from("imported_contacts")
      .select("*")
      .in("id", contactIds);

    if (fetchErr) throw fetchErr;
    if (!contacts || contacts.length < 2) {
      return new Response(JSON.stringify({ error: "Contatti non trovati" }), {
        status: 404,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Group by normalized company_name
    const groups = new Map<string, typeof contacts>();
    for (const c of contacts) {
      const key = (c.company_name || "").toLowerCase().trim();
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    let mergedCount = 0;
    let deletedCount = 0;

    for (const [, group] of groups) {
      if (group.length < 2) continue;

      // Score each contact for completeness
      const scored = group.map(c => {
        let score = 0;
        if (c.email) score += 20;
        if (c.phone || c.mobile) score += 15;
        if (c.name) score += 10;
        if (c.position) score += 5;
        if (c.city) score += 5;
        if (c.country) score += 5;
        if (c.company_alias) score += 5;
        if (c.contact_alias) score += 5;
        if (c.deep_search_at) score += 10;
        if (c.enrichment_data) score += 10;
        if (c.wca_partner_id) score += 15;
        return { contact: c, score };
      });

      // Keep the richest
      scored.sort((a, b) => b.score - a.score);
      const keeper = scored[0].contact;
      const dupes = scored.slice(1).map(s => s.contact);

      // Merge missing fields from dupes into keeper
      const updates: Record<string, unknown> = {};
      const mergeField = (field: string) => {
        if (!keeper[field]) {
          for (const d of dupes) {
            if (d[field]) { updates[field] = d[field]; break; }
          }
        }
      };

      for (const f of ["email", "phone", "mobile", "name", "position", "city", "country",
        "address", "zip_code", "company_alias", "contact_alias", "note", "origin",
        "wca_partner_id", "wca_match_confidence"]) {
        mergeField(f);
      }

      // Merge interaction counts
      const totalInteractions = group.reduce((sum, c) => sum + (c.interaction_count || 0), 0);
      if (totalInteractions > (keeper.interaction_count || 0)) {
        updates.interaction_count = totalInteractions;
      }

      // Apply updates to keeper
      if (Object.keys(updates).length > 0) {
        await admin.from("imported_contacts").update(updates).eq("id", keeper.id);
      }

      // Move interactions from dupes to keeper
      const dupeIds = dupes.map(d => d.id);
      await admin
        .from("contact_interactions")
        .update({ contact_id: keeper.id })
        .in("contact_id", dupeIds);

      // Delete dupes
      const { error: delErr } = await admin
        .from("imported_contacts")
        .delete()
        .in("id", dupeIds);

      if (!delErr) {
        deletedCount += dupeIds.length;
        mergedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mergedGroups: mergedCount,
        deletedRecords: deletedCount,
        keptRecords: groups.size,
      }),
      {
        headers: { ...dynCors, "Content-Type": "application/json" },
      }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});

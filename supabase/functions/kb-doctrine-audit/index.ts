/**
 * kb-doctrine-audit — Snapshot + audit della Knowledge Base.
 *
 * Produce un report (markdown + jsonb) salvato in `kb_audit_reports`.
 * NON modifica nulla: si limita a contare. La governance applica i fix
 * via proposte in `kb_entry_proposals` (KB Supervisor UI).
 *
 * Conta:
 *   - duplicati esatti (hash su content normalizzato)
 *   - duplicati semantici (cosine ≥ 0.92 su embedding, se presente)
 *   - numeri/cifre canonici trovati fuori dall'entry "Fatti Canonici TMWE"
 *   - entry senza tag e senza family
 *   - distribuzione per family canonica (doctrine/procedures/personas/...)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { mapCategoryToFamily, KB_FAMILIES, type KbFamily } from "../_shared/kbCategoryMapper.ts";

interface KbRow {
  id: string;
  title: string | null;
  category: string | null;
  family: string | null;
  tags: string[] | null;
  content: string | null;
  embedding: number[] | null;
}

const CANONICAL_FACTS_HINTS = ["fatti canonici", "canonical facts", "canonical-facts"];

// Numeri "canonici" da centralizzare: spedizioni/anno, partner, paesi, anni di attività.
// Pattern intenzionalmente conservativo per evitare falsi positivi su prezzi/percentuali.
const NUMBER_PATTERN = /\b(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})\b\s*(spedizion|partner|aziende|paesi|operazion|uffici|sed[ie])\b/gi;

function normalize(content: string): string {
  return content
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h.toString(16);
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

serve(async (req: Request) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const triggeredBy: string = (body && typeof body.triggered_by === "string") ? body.triggered_by : "manual";
    const semanticThreshold: number = typeof body?.semantic_threshold === "number" ? body.semantic_threshold : 0.92;

    const { data: rows, error } = await supabase
      .from("kb_entries")
      .select("id, title, category, family, tags, content, embedding")
      .eq("is_active", true)
      .is("deleted_at", null);
    if (error) throw error;

    const entries = (rows ?? []) as KbRow[];
    const totalEntries = entries.length;

    // Identifica le entry "Fatti Canonici" (Single Source of Truth dei numeri)
    const canonicalFactIds = new Set(
      entries
        .filter((e) => CANONICAL_FACTS_HINTS.some((h) => (e.title ?? "").toLowerCase().includes(h)))
        .map((e) => e.id),
    );

    // 1) Duplicati esatti (hash content normalizzato)
    const buckets = new Map<string, string[]>();
    for (const e of entries) {
      const n = normalize(e.content ?? "");
      if (n.length < 40) continue;
      const key = hash(n);
      const arr = buckets.get(key) ?? [];
      arr.push(e.id);
      buckets.set(key, arr);
    }
    const exactDuplicateGroups: string[][] = [];
    let exactDuplicates = 0;
    for (const ids of buckets.values()) {
      if (ids.length > 1) {
        exactDuplicateGroups.push(ids);
        exactDuplicates += ids.length - 1;
      }
    }

    // 2) Duplicati semantici (solo entry con embedding)
    const withEmb = entries.filter((e) => Array.isArray(e.embedding) && e.embedding!.length > 0);
    const semanticPairs: Array<{ a: string; b: string; score: number }> = [];
    for (let i = 0; i < withEmb.length; i++) {
      for (let j = i + 1; j < withEmb.length; j++) {
        const score = cosine(withEmb[i].embedding!, withEmb[j].embedding!);
        if (score >= semanticThreshold) {
          semanticPairs.push({ a: withEmb[i].id, b: withEmb[j].id, score: Math.round(score * 1000) / 1000 });
        }
      }
    }

    // 3) Numeri canonici fuori dalla SoT
    const offenders: Array<{ id: string; title: string; matches: string[] }> = [];
    for (const e of entries) {
      if (canonicalFactIds.has(e.id)) continue;
      const matches = (e.content ?? "").match(NUMBER_PATTERN);
      if (matches && matches.length > 0) {
        offenders.push({ id: e.id, title: e.title ?? "(senza titolo)", matches: matches.slice(0, 5) });
      }
    }

    // 4) Entry senza tag / senza family
    const withoutTags = entries.filter((e) => !e.tags || e.tags.length === 0).map((e) => e.id);
    const withoutFamily = entries.filter((e) => !e.family).map((e) => e.id);

    // 5) Distribuzione per family canonica (basata su mapping dedotto se family non settata)
    const familyDist: Record<KbFamily, number> = {
      doctrine: 0, procedures: 0, personas: 0, playbooks: 0, glossary: 0, "data-schema": 0,
    };
    for (const e of entries) {
      const fam = (e.family as KbFamily) ?? mapCategoryToFamily(e.category);
      if ((KB_FAMILIES as readonly string[]).includes(fam)) familyDist[fam]++;
    }

    // Markdown report
    const md = [
      `# KB Doctrine Audit — ${new Date().toISOString()}`,
      ``,
      `- **Total active entries**: ${totalEntries}`,
      `- **Exact duplicates**: ${exactDuplicates} (${exactDuplicateGroups.length} groups)`,
      `- **Semantic duplicates (≥${semanticThreshold})**: ${semanticPairs.length} pairs`,
      `- **Numbers outside canonical-facts**: ${offenders.length} entries`,
      `- **Entries without tags**: ${withoutTags.length}`,
      `- **Entries without family**: ${withoutFamily.length}`,
      ``,
      `## Family distribution (proposed mapping)`,
      ...KB_FAMILIES.map((f) => `- ${f}: ${familyDist[f]}`),
      ``,
      `## Numeric offenders (top 20)`,
      ...offenders.slice(0, 20).map((o) => `- [${o.id.slice(0, 8)}] ${o.title} → ${o.matches.join(", ")}`),
      ``,
      `## Exact duplicate groups (top 10)`,
      ...exactDuplicateGroups.slice(0, 10).map((g) => `- ${g.length} copie: ${g.map((id) => id.slice(0, 8)).join(", ")}`),
    ].join("\n");

    const proposedChanges =
      exactDuplicates + semanticPairs.length + offenders.length + withoutTags.length + withoutFamily.length;

    const { data: inserted, error: insErr } = await supabase
      .from("kb_audit_reports")
      .insert({
        triggered_by: triggeredBy,
        total_entries: totalEntries,
        exact_duplicates: exactDuplicates,
        semantic_duplicates: semanticPairs.length,
        numbers_outside_canonical: offenders.length,
        entries_without_tags: withoutTags.length,
        entries_without_family: withoutFamily.length,
        family_distribution: familyDist,
        proposed_changes: proposedChanges,
        report_markdown: md,
        details: {
          exact_duplicate_groups: exactDuplicateGroups.slice(0, 50),
          semantic_pairs: semanticPairs.slice(0, 100),
          offenders: offenders.slice(0, 100),
          without_tags_sample: withoutTags.slice(0, 100),
          without_family_sample: withoutFamily.slice(0, 100),
        },
      })
      .select("id")
      .maybeSingle();
    if (insErr) throw insErr;

    return new Response(
      JSON.stringify({
        ok: true,
        report_id: inserted?.id ?? null,
        summary: {
          totalEntries,
          exactDuplicates,
          semanticDuplicates: semanticPairs.length,
          numbersOutsideCanonical: offenders.length,
          entriesWithoutTags: withoutTags.length,
          entriesWithoutFamily: withoutFamily.length,
          familyDistribution: familyDist,
          proposedChanges,
        },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
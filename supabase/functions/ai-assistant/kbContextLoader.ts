/**
 * kbContextLoader.ts — Knowledge base retrieval with tiered loading strategy.
 *
 * Implements:
 * - Level 0: System core doctrine (always)
 * - Level 1: Context tag-based loading
 * - Level 2: RAG semantic retrieval
 * - Level 3: Priority-based fallback
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface ContextTags {
  tags: string[];
  categories: string[];
  priority_boost: number;
}

export async function loadKBContext(
  supabase: SupabaseClient,
  query?: string,
  userId?: string,
  contextTags?: ContextTags,
): Promise<string> {
  const parts: string[] = [];
  const seenIds = new Set<string>();

  // ── LEVEL 0: Always load system_core doctrine ──
  try {
    let coreQ = supabase
      .from("kb_entries")
      .select("id, title, content")
      .eq("is_active", true)
      .eq("category", "system_doctrine")
      .overlaps("tags", ["system_core"]);

    if (userId) {
      coreQ = coreQ.or(`user_id.eq.${userId},user_id.is.null`);
    } else {
      coreQ = coreQ.is("user_id", null);
    }

    const { data: coreEntries } = await coreQ
      .order("priority", { ascending: false })
      .limit(10);

    if (coreEntries?.length) {
      for (const e of coreEntries as Array<{ id: string; title: string; content: string }>) {
        if (!seenIds.has(e.id)) {
          seenIds.add(e.id);
          parts.push(`[KB:${e.title}]\n${e.content}`);
        }
      }
    }
  } catch (e: unknown) {
    console.warn("System doctrine loading failed:", extractErrorMessage(e));
  }

  // ── LEVEL 1: Contextual tag-based loading ──
  if (contextTags && (contextTags.tags.length > 0 || contextTags.categories.length > 0)) {
    try {
      let q = supabase
        .from("kb_entries")
        .select("id, title, content, category, tags, priority")
        .eq("is_active", true);

      if (userId) {
        q = q.or(`user_id.eq.${userId},user_id.is.null`);
      } else {
        q = q.is("user_id", null);
      }

      if (contextTags.categories.length > 0) {
        q = q.in("category", contextTags.categories);
      }
      if (contextTags.tags.length > 0) {
        q = q.overlaps("tags", contextTags.tags);
      }

      q = q.order("priority", { ascending: false }).limit(8);
      const { data } = await q;

      if (data?.length) {
        for (const e of data as Record<string, unknown>[]) seenIds.add(e.id as string);
        const entries = (data as Record<string, unknown>[])
          .map((e) => `### ${e.title} [${(Array.isArray(e.tags) ? e.tags.join(", ") : e.category) || ""}]\n${e.content}`)
          .join("\n\n");
        parts.push(`KNOWLEDGE BASE CONTESTUALE (tags: ${contextTags.tags.join(", ")}):\n${entries}`);
      }
    } catch (e: unknown) {
      console.warn("Context tag KB loading failed:", extractErrorMessage(e));
    }
  }

  // ── LEVEL 2: RAG semantic retrieval ──
  if (query && query.trim().length >= 8) {
    try {
      const { ragSearchKb } = await import("../_shared/embeddings.ts");
      const ragCount = seenIds.size > 0 ? 4 : 8;
      const matches = await ragSearchKb(supabase, query, {
        matchCount: ragCount, matchThreshold: 0.25, minPriority: 3, onlyActive: true,
      });
      const filtered = matches.filter((e: Record<string, unknown>) => !seenIds.has(e.id as string));
      if (filtered.length > 0) {
        const entries = filtered
          .map((e: Record<string, unknown>) => `### ${e.title} [sim=${(e.similarity as number).toFixed(2)} · ${(Array.isArray(e.tags) ? e.tags.join(", ") : e.category) || ""}]\n${e.content}`)
          .join("\n\n");
        parts.push(`KNOWLEDGE BASE AZIENDALE (RAG retrieval):\n${entries}`);
      }
    } catch (e: unknown) {
      console.warn("RAG retrieval failed:", extractErrorMessage(e));
    }
  }

  // ── LEVEL 3: Fallback by priority ──
  if (parts.length === 0) {
    const { data } = await supabase
      .from("kb_entries")
      .select("id, title, content, category, tags")
      .eq("is_active", true)
      .gte("priority", 5)
      .or(userId ? `user_id.eq.${userId},user_id.is.null` : "user_id.is.null")
      .order("priority", { ascending: false })
      .limit(10);

    if (data?.length) {
      for (const e of data as Record<string, unknown>[]) seenIds.add(e.id as string);
      const entries = (data as Record<string, unknown>[])
        .map((e) => `### ${e.title} [${(Array.isArray(e.tags) ? e.tags.join(", ") : e.category) || ""}]\n${e.content}`)
        .join("\n\n");
      parts.push(`KNOWLEDGE BASE AZIENDALE:\n${entries}`);
    }
  }

  if (parts.length === 0) return "";

  // Track KB access counts (fire-and-forget)
  if (seenIds.size > 0) {
    supabase.rpc("increment_kb_access", { entry_ids: Array.from(seenIds) })
      .then(() => {})
      .catch((e: unknown) => console.warn("increment_kb_access failed:", extractErrorMessage(e)));
  }

  return "\n\n" + parts.join("\n\n");
}

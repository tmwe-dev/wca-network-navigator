/**
 * useRecentCommandPrompts — top-3 prompt suggestions derived from the actual
 * recent user messages in command_messages. No static fallbacks: if the user
 * has no history, returns an empty list (the UI will render nothing).
 *
 * Heuristic:
 *  - Pulls the last N user messages (last 60 days) for the current user
 *  - Normalizes (trim, collapse spaces, lowercase) and groups by normalized text
 *  - Ranks by frequency desc, then by most-recent-use desc
 *  - Returns up to 3 distinct prompts (length 5..160 chars)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

const MAX_SUGGESTIONS = 3;
const LOOKBACK_DAYS = 60;
const FETCH_LIMIT = 200;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeKey(text: string): string {
  return normalize(text).toLowerCase();
}

export function useRecentCommandPrompts() {
  return useQuery({
    queryKey: queryKeys.v2.recentCommandPrompts,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data: sessionRes } = await supabase.auth.getSession();
      const userId = sessionRes.session?.user?.id;
      if (!userId) return [];

      // Conversations owned by the user (RLS already restricts, but we filter
      // explicitly to keep the query narrow and indexed).
      const { data: convs, error: convErr } = await supabase
        .from("command_conversations")
        .select("id")
        .eq("user_id", userId)
        .limit(200);
      if (convErr || !convs || convs.length === 0) return [];

      const sinceIso = new Date(
        Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: msgs, error: msgErr } = await supabase
        .from("command_messages")
        .select("content, created_at")
        .in("conversation_id", convs.map((c) => c.id))
        .eq("role", "user")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);
      if (msgErr || !msgs) return [];

      const buckets = new Map<
        string,
        { display: string; count: number; lastAt: number }
      >();

      for (const m of msgs) {
        const display = normalize(String(m.content ?? ""));
        if (display.length < 5 || display.length > 160) continue;
        const key = normalizeKey(display);
        if (!key) continue;
        const ts = new Date(m.created_at).getTime();
        const existing = buckets.get(key);
        if (existing) {
          existing.count += 1;
          if (ts > existing.lastAt) existing.lastAt = ts;
        } else {
          buckets.set(key, { display, count: 1, lastAt: ts });
        }
      }

      const ranked = Array.from(buckets.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastAt - a.lastAt;
      });

      return ranked.slice(0, MAX_SUGGESTIONS).map((b) => b.display);
    },
  });
}
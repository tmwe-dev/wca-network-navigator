/**
 * useDeepSearchV2 — Deep search across multiple tables + AI
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";

interface DeepSearchResult {
  readonly type: "partner" | "contact" | "prospect" | "kb";
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly score: number;
}

export function useDeepSearchV2() {
  const [results, setResults] = useState<DeepSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); return; }
    setIsSearching(true);
    try {
      const [partnerRes, contactRes, prospectRes] = await Promise.all([
        supabase.from("partners").select("id, company_name, country_name").ilike("company_name", `%${query}%`).limit(10),
        supabase.from("imported_contacts").select("id, name, company_name").or(`name.ilike.%${query}%,company_name.ilike.%${query}%`).limit(10),
        supabase.from("prospects").select("id, company_name, city").ilike("company_name", `%${query}%`).limit(10),
      ]);
      const combined: DeepSearchResult[] = [
        ...(partnerRes.data ?? []).map((r) => ({ type: "partner" as const, id: r.id, title: r.company_name, subtitle: r.country_name, score: 1 })),
        ...(contactRes.data ?? []).map((r) => ({ type: "contact" as const, id: r.id, title: r.name ?? r.company_name ?? "N/A", subtitle: r.company_name, score: 0.9 })),
        ...(prospectRes.data ?? []).map((r) => ({ type: "prospect" as const, id: r.id, title: r.company_name, subtitle: r.city, score: 0.8 })),
      ];
      setResults(combined);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const aiSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const res = await invokeEdge<{ results: DeepSearchResult[] }>("unified-assistant", {
        body: { message: query, scope: "deep-search" },
        context: "deepSearchV2",
      });
      setResults(res.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  return { results, isSearching, search, aiSearch, clearResults: () => setResults([]) };
}

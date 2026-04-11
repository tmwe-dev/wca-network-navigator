/**
 * DeepSearchPage — Cross-module advanced search
 */
import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Globe, Users, FileText } from "lucide-react";

interface SearchResult {
  readonly type: "partner" | "contact" | "activity";
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
}

export function DeepSearchPage(): React.ReactElement {
  const [query, setQuery] = useState("");

  const { data: results, isLoading } = useQuery({
    queryKey: ["v2-deep-search", query],
    enabled: query.length >= 3,
    queryFn: async (): Promise<SearchResult[]> => {
      const r: SearchResult[] = [];
      const [partners, contacts, activities] = await Promise.all([
        supabase.from("partners").select("id, company_name, country_name, city").ilike("company_name", `%${query}%`).limit(10),
        supabase.from("imported_contacts").select("id, name, company_name, email").or(`name.ilike.%${query}%,company_name.ilike.%${query}%`).limit(10),
        supabase.from("activities").select("id, title, activity_type").ilike("title", `%${query}%`).limit(10),
      ]);
      partners.data?.forEach((p) => r.push({ type: "partner", id: p.id, title: p.company_name, subtitle: `${p.city ?? ""} ${p.country_name ?? ""}`.trim() }));
      contacts.data?.forEach((c) => r.push({ type: "contact", id: c.id, title: c.name ?? c.company_name ?? "—", subtitle: c.email ?? "" }));
      activities.data?.forEach((a) => r.push({ type: "activity", id: a.id, title: a.title, subtitle: a.activity_type }));
      return r;
    },
  });

  const iconMap = { partner: <Globe className="h-4 w-4" />, contact: <Users className="h-4 w-4" />, activity: <FileText className="h-4 w-4" /> };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Search className="h-6 w-6" />Deep Search</h1>
        <p className="text-sm text-muted-foreground">Ricerca avanzata cross-modulo.</p>
      </div>
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background pl-10 pr-3 py-2.5 text-sm text-foreground"
          placeholder="Cerca partner, contatti, attività..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      {isLoading && query.length >= 3 ? <p className="text-sm text-muted-foreground">Ricerca...</p> : null}
      {results && results.length > 0 ? (
        <div className="space-y-2 max-w-xl">
          {results.map((r) => (
            <div key={`${r.type}-${r.id}`} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 cursor-pointer transition-colors">
              <span className="text-muted-foreground">{iconMap[r.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase">{r.type}</span>
            </div>
          ))}
        </div>
      ) : query.length >= 3 && !isLoading ? (
        <p className="text-sm text-muted-foreground">Nessun risultato per "{query}"</p>
      ) : null}
    </div>
  );
}

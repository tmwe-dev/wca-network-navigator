/**
 * DeepSearchPage — Cross-module advanced search with AI
 */
import * as React from "react";
import { useState, useCallback } from "react";
import { useDeepSearchV2 } from "@/v2/hooks/useDeepSearchV2";
import { Search, Globe, Users, FileText, Target, Bot } from "lucide-react";
import { Button } from "../atoms/Button";

const iconMap = {
  partner: <Globe className="h-4 w-4" />,
  contact: <Users className="h-4 w-4" />,
  prospect: <Target className="h-4 w-4" />,
  activity: <FileText className="h-4 w-4" />,
  kb: <Bot className="h-4 w-4" />,
} as const;

export function DeepSearchPage(): React.ReactElement {
  const [query, setQuery] = useState("");
  const { results, isSearching, search, aiSearch } = useDeepSearchV2();

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.length >= 3) search(value);
  }, [search]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Search className="h-6 w-6" />Deep Search
        </h1>
        <p className="text-sm text-muted-foreground">Ricerca avanzata cross-modulo con AI.</p>
      </div>

      <div className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border bg-background pl-10 pr-3 py-2.5 text-sm text-foreground"
            placeholder="Cerca partner, contatti, prospect..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>
        <Button
          variant="outline"
          onClick={() => { if (query.length >= 3) aiSearch(query); }}
          disabled={query.length < 3 || isSearching}
          className="gap-1.5"
        >
          <Bot className="h-4 w-4" />AI Search
        </Button>
      </div>

      {isSearching ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Ricerca in corso...
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-2 max-w-xl">
          <p className="text-xs text-muted-foreground">{results.length} risultati</p>
          {results.map((r) => (
            <div key={`${r.type}-${r.id}`} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 cursor-pointer transition-colors">
              <span className="text-muted-foreground">{iconMap[r.type] ?? <FileText className="h-4 w-4" />}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground uppercase">{r.type}</span>
                {r.score < 1 && (
                  <span className="text-[10px] text-muted-foreground">{Math.round(r.score * 100)}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : query.length >= 3 && !isSearching ? (
        <p className="text-sm text-muted-foreground">Nessun risultato per "{query}"</p>
      ) : null}
    </div>
  );
}

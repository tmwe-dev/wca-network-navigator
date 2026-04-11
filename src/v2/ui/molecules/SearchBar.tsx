/**
 * SearchBar molecule — STEP 4 Design System v2
 * Input di ricerca con debounce e clear.
 */

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "../atoms/Input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  readonly onSearch: (query: string) => void;
  readonly placeholder?: string;
  readonly debounceMs?: number;
  readonly className?: string;
  readonly initialValue?: string;
}

export function SearchBar({
  onSearch, placeholder = "Cerca...", debounceMs = 300,
  className, initialValue = "",
}: SearchBarProps): React.ReactElement {
  const [query, setQuery] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => onSearch(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs, onSearch]);

  const handleClear = useCallback(() => {
    setQuery("");
    onSearch("");
  }, [onSearch]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {query ? (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

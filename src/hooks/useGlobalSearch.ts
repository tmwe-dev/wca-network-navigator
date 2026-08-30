/**
 * useGlobalSearch — ricerca trasversale (partner, contatti, campi di sistema)
 * con debounce. Usato dalla palette globale ⌘K.
 */
import { useEffect, useState } from "react";
import { searchEverything, type GlobalDataResults } from "@/data/globalSearch";
import { createLogger } from "@/lib/log";

const log = createLogger("useGlobalSearch");
const EMPTY: GlobalDataResults = { partners: [], contacts: [], fields: [] };

export function useGlobalSearch(term: string, enabled: boolean) {
  const [debounced, setDebounced] = useState("");
  const [data, setData] = useState<GlobalDataResults>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || debounced.length < 2) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchEverything(debounced)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        log.error("global search failed", { error: err instanceof Error ? err.message : String(err) });
        if (!cancelled) setData(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, debounced]);

  return { query: debounced, data, loading };
}

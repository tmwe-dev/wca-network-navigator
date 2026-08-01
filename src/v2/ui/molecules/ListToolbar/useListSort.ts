/**
 * useListSort — hook stato (sortKey, sortDir) con persistenza localStorage.
 * Logica condivisa per WCA / CRM / BCA list toolbars.
 */
import { useCallback, useEffect, useState } from "react";

export type SortDir = "asc" | "desc";

export interface ListSortState<K extends string = string> {
  sortKey: K;
  sortDir: SortDir;
}

export interface UseListSortResult<K extends string = string> extends ListSortState<K> {
  setSortKey: (key: K) => void;
  toggleDir: () => void;
  /** Click su una pillola di ordinamento: se è la stessa key inverte la direzione, altrimenti cambia key e resetta dir. */
  cycle: (key: K) => void;
}

function readPersisted<K extends string>(storageKey: string, fallback: ListSortState<K>): ListSortState<K> {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ListSortState<K>>;
    return {
      sortKey: (parsed.sortKey as K) || fallback.sortKey,
      sortDir: parsed.sortDir === "desc" ? "desc" : "asc",
    };
  } catch {
    return fallback;
  }
}

export function useListSort<K extends string = string>(
  storageKey: string,
  defaultKey: K,
  defaultDir: SortDir = "asc"
): UseListSortResult<K> {
  const [state, setState] = useState<ListSortState<K>>(() =>
    readPersisted<K>(storageKey, { sortKey: defaultKey, sortDir: defaultDir })
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* swallow quota / SSR */
    }
  }, [storageKey, state]);

  const setSortKey = useCallback((key: K) => setState((s) => ({ ...s, sortKey: key })), []);
  const toggleDir = useCallback(
    () => setState((s) => ({ ...s, sortDir: s.sortDir === "asc" ? "desc" : "asc" })),
    []
  );
  const cycle = useCallback(
    (key: K) =>
      setState((s) =>
        s.sortKey === key
          ? { ...s, sortDir: s.sortDir === "asc" ? "desc" : "asc" }
          : { sortKey: key, sortDir: "asc" }
      ),
    []
  );

  return { ...state, setSortKey, toggleDir, cycle };
}
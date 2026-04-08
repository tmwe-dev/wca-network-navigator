import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * useUrlState — sync any serialisable state into the URL search params.
 *
 * Usage:
 *   const [country, setCountry] = useUrlState<string>("country", "");
 *   const [tab, setTab] = useUrlState<"contacts"|"cards">("tab", "contacts");
 *   const [countries, setCountries] = useUrlState<string[]>("c", [], {
 *     parse: (v) => v ? v.split(",") : [],
 *     serialize: (v) => v.join(","),
 *   });
 *
 * Why: filters/tabs/sort that live in URL are shareable, refresh-safe,
 * back-button friendly, and let Aurora deeplink users to a state.
 */
export interface UrlStateOptions<T> {
  parse?: (raw: string | null) => T;
  serialize?: (value: T) => string;
  /** If true (default), absent params return defaultValue silently. */
  replace?: boolean;
}

export function useUrlState<T>(
  key: string,
  defaultValue: T,
  options: UrlStateOptions<T> = {}
): [T, (next: T | ((prev: T) => T)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const parse =
    options.parse ??
    ((raw: string | null) => (raw === null ? defaultValue : (raw as unknown as T)));
  const serialize =
    options.serialize ??
    ((v: T) => (v === null || v === undefined ? "" : String(v)));

  const value = useMemo<T>(() => parse(searchParams.get(key)), [searchParams, key, parse]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(value)
          : next;

      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const serialized = serialize(resolved);
          const isEmpty =
            resolved === null ||
            resolved === undefined ||
            resolved === "" ||
            (Array.isArray(resolved) && resolved.length === 0) ||
            serialized === "" ||
            serialized === serialize(defaultValue);

          if (isEmpty) {
            params.delete(key);
          } else {
            params.set(key, serialized);
          }
          return params;
        },
        { replace: options.replace ?? true }
      );
    },
    [setSearchParams, key, serialize, value, defaultValue, options.replace]
  );

  return [value, setValue];
}

/** Convenience: comma-separated string array in URL */
export function useUrlArrayState(
  key: string,
  defaultValue: string[] = []
): [string[], (next: string[] | ((prev: string[]) => string[])) => void] {
  return useUrlState<string[]>(key, defaultValue, {
    parse: (raw) => (raw ? raw.split(",").filter(Boolean) : defaultValue),
    serialize: (v) => v.join(","),
  });
}

/** Convenience: number with parsing */
export function useUrlNumberState(
  key: string,
  defaultValue: number
): [number, (next: number | ((prev: number) => number)) => void] {
  return useUrlState<number>(key, defaultValue, {
    parse: (raw) => {
      if (raw === null) return defaultValue;
      const n = Number(raw);
      return Number.isFinite(n) ? n : defaultValue;
    },
    serialize: (v) => String(v),
  });
}

/** Convenience: boolean */
export function useUrlBoolState(
  key: string,
  defaultValue = false
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  return useUrlState<boolean>(key, defaultValue, {
    parse: (raw) => (raw === null ? defaultValue : raw === "1" || raw === "true"),
    serialize: (v) => (v ? "1" : "0"),
  });
}

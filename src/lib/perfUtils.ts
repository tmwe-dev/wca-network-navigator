/**
 * Performance utilities for WCA Network Navigator — Sprint I.4
 *
 * Provides hooks and helpers to reduce unnecessary renders and
 * stabilise callback / selector references across re-renders.
 */
import { useCallback, useEffect, useRef, useState, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  useStableCallback                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns a function whose *identity* never changes but that always
 * calls the latest version of `callback`.  This avoids the stale-
 * closure trap of `useCallback` without requiring a dependency array.
 *
 * ```ts
 * const onSave = useStableCallback((id: string) => save(id, formData));
 * ```
 */
 
export function useStableCallback<T extends (...args: never[]) => unknown>(
  callback: T
): T {
  const ref = useRef<T>(callback);

  // Keep the ref up-to-date on every render (synchronous, no effect delay).
  ref.current = callback;

  // The stable wrapper is created once and never changes identity.
   
  const stable = useCallback(
    ((...args: Parameters<T>) => ref.current(...args)) as T,
    []
  );

  return stable;
}

/* ------------------------------------------------------------------ */
/*  useDebouncedValue                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms
 * of inactivity.  Useful for search inputs where you want to avoid
 * firing a query on every keystroke.
 *
 * ```ts
 * const debouncedSearch = useDebouncedValue(searchTerm, 300);
 * ```
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* ------------------------------------------------------------------ */
/*  createMemoSelector                                                 */
/* ------------------------------------------------------------------ */

/**
 * Creates a memoised selector function.  Given an `extractor` that
 * pulls raw data and a `transform` that derives the result, the
 * returned selector only recomputes when the extracted input changes
 * (by shallow equality).
 *
 * Designed for use with Zustand or React Query `select` options:
 *
 * ```ts
 * const selectActivePartners = createMemoSelector(
 *   (data: PartnerList) => data.partners,
 *   (partners) => partners.filter(p => p.isActive),
 * );
 * ```
 */
export function createMemoSelector<TInput, TExtracted, TResult>(
  extractor: (input: TInput) => TExtracted,
  transform: (extracted: TExtracted) => TResult
): (input: TInput) => TResult {
  let lastExtracted: TExtracted | undefined;
  let lastResult: TResult | undefined;
  let initialised = false;

  return (input: TInput): TResult => {
    const extracted = extractor(input);

    if (!initialised || !Object.is(extracted, lastExtracted)) {
      lastExtracted = extracted;
      lastResult = transform(extracted);
      initialised = true;
    }

    return lastResult as TResult;
  };
}

/* ------------------------------------------------------------------ */
/*  React hook wrapper for createMemoSelector                          */
/* ------------------------------------------------------------------ */

/**
 * Hook version of `createMemoSelector` — creates the selector once
 * and returns a stable reference.
 */
export function useMemoSelector<TInput, TExtracted, TResult>(
  extractor: (input: TInput) => TExtracted,
  transform: (extracted: TExtracted) => TResult
): (input: TInput) => TResult {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createMemoSelector(extractor, transform), []);
}

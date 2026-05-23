import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Unit test (standalone) per il pattern cache TTL usato da getActiveFolders.
 * Non importa index.ts per evitare di trascinare il typecheck di Deno.serve
 * e dei moduli condivisi (debiti pre-esistenti su _shared/monitoring.ts).
 * Replichiamo qui la stessa logica.
 */

type Row = { slug: string };
const TTL_MS = 60_000;

function makeCachedFetcher(rows: Row[], now: () => number) {
  let calls = 0;
  let cache: { at: number; data: Row[] } | null = null;
  const fetcher = async (): Promise<Row[]> => {
    const t = now();
    if (cache && t - cache.at < TTL_MS) return cache.data;
    calls++;
    cache = { at: t, data: rows };
    return await Promise.resolve(rows);
  };
  return { fetcher, calls: () => calls, reset: () => { cache = null; } };
}

Deno.test("[FN-CLASSIFY] cache TTL: 3 chiamate entro TTL → 1 query", async () => {
  let t = 1000;
  const { fetcher, calls } = makeCachedFetcher([{ slug: "to_sort" }], () => t);
  await fetcher();
  t += 1000;
  await fetcher();
  t += 5000;
  const r = await fetcher();
  assertEquals(calls(), 1);
  assertEquals(r.length, 1);
});

Deno.test("[FN-CLASSIFY] cache TTL: oltre TTL → re-fetch", async () => {
  let t = 0;
  const { fetcher, calls } = makeCachedFetcher([{ slug: "to_sort" }], () => t);
  await fetcher();
  t += TTL_MS + 1;
  await fetcher();
  assertEquals(calls(), 2);
});

Deno.test("[FN-CLASSIFY] cache TTL: reset esplicito → re-fetch", async () => {
  let t = 0;
  const { fetcher, calls, reset } = makeCachedFetcher([{ slug: "to_sort" }], () => t);
  await fetcher();
  reset();
  await fetcher();
  assertEquals(calls(), 2);
});
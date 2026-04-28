/**
 * embeddings — wrapper per generazione embedding via Lovable AI Gateway
 * (compatibile OpenAI /v1/embeddings).
 *
 * Vol. II §11 (RAG architecture).
 *
 * Modello default: text-embedding-3-small (1536 dim, costo basso, qualità ok
 * per KB freight forwarding multilingua).
 */

// Lovable AI Gateway non supporta più embedding models. Usiamo OpenAI direct.
const LOVABLE_EMBEDDINGS_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

export interface EmbedOptions {
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class EmbeddingError extends Error {
  constructor(
    public readonly kind: "no_api_key" | "http" | "timeout" | "invalid_response" | "network",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

/**
 * Genera embedding per UN testo. Per batch usa `embedBatch`.
 * Ritorna array di lunghezza EMBEDDING_DIM.
 */
export async function embedOne(text: string, opts: EmbedOptions = {}): Promise<number[]> {
  const r = await embedBatch([text], opts);
  return r[0];
}

/**
 * Genera embedding per più testi in una singola chiamata.
 * Lovable Gateway accetta `input: string[]` come OpenAI.
 */
export async function embedBatch(texts: string[], opts: EmbedOptions = {}): Promise<number[][]> {
  if (texts.length === 0) return [];
  // Preferisci OPENAI_API_KEY (supporta embedding); LOVABLE_API_KEY come fallback legacy.
  const openaiKey = opts.apiKey || Deno.env.get("OPENAI_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!openaiKey && !lovableKey) {
    throw new EmbeddingError("no_api_key", "Neither OPENAI_API_KEY nor LOVABLE_API_KEY configured");
  }
  const baseModel = (opts.model || DEFAULT_EMBEDDING_MODEL).replace(/^openai\//, "");
  const timeoutMs = opts.timeoutMs ?? 30000;

  // Provider chain: OpenAI nativo prima (se chiave presente), poi Lovable Gateway come
  // fallback. Su 401/403 OpenAI proviamo automaticamente il gateway: la chiave OpenAI può
  // essere scaduta/invalida ma il gateway resta operativo.
  const providers: Array<{ name: string; url: string; key: string; model: string }> = [];
  if (openaiKey) {
    providers.push({ name: "openai", url: OPENAI_EMBEDDINGS_URL, key: openaiKey, model: baseModel });
  }
  if (lovableKey) {
    providers.push({ name: "lovable", url: LOVABLE_EMBEDDINGS_URL, key: lovableKey, model: `openai/${baseModel}` });
  }

  let lastErr: EmbeddingError | null = null;
  for (const p of providers) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const resp = await fetch(p.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: p.model,
          input: texts.map((t) => (t || "").slice(0, 8000)),
        }),
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        const err = new EmbeddingError("http", `Embedding HTTP ${resp.status} via ${p.name}: ${errText.slice(0, 200)}`, resp.status);
        // 401/403 su OpenAI → retry sul prossimo provider (gateway)
        if ((resp.status === 401 || resp.status === 403) && p.name === "openai") {
          console.warn(`[embeddings] OpenAI auth ${resp.status}, falling back to Lovable Gateway`);
          lastErr = err;
          continue;
        }
        throw err;
      }
      const data = await resp.json();
      const arr = Array.isArray(data?.data) ? data.data : null;
      if (!arr || arr.length !== texts.length) {
        throw new EmbeddingError("invalid_response", "Embedding response missing data[]");
      }
      return arr.map((row: Record<string, unknown>) => {
        const v = row?.embedding;
        const vectorLength = Array.isArray(v) ? v.length : undefined;
        if (!Array.isArray(v) || vectorLength !== EMBEDDING_DIM) {
          throw new EmbeddingError("invalid_response", `Invalid embedding vector dim ${vectorLength}`);
        }
        return v as number[];
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof EmbeddingError) {
        lastErr = err;
        continue;
      }
      if ((err as { name?: string })?.name === "AbortError") {
        lastErr = new EmbeddingError("timeout", `Embedding timeout via ${p.name} after ${timeoutMs}ms`);
        continue;
      }
      lastErr = new EmbeddingError("network", err instanceof Error ? err.message : String(err));
    }
  }
  throw lastErr ?? new EmbeddingError("network", "All embedding providers failed");
}

/**
 * RAG retrieval: cerca KB entries più rilevanti via match_kb_entries RPC.
 *
 * @param supabase  client Supabase (preferibilmente service_role per evitare RLS)
 * @param query     stringa query (verrà embeddata)
 * @param opts      filtri opzionali
 */
export interface KbMatchOpts {
  matchCount?: number;
  matchThreshold?: number;
  categories?: string[];
  minPriority?: number;
  onlyActive?: boolean;
  embedOpts?: EmbedOptions;
}

export interface KbMatchRow {
  id: string;
  title: string;
  content: string;
  category: string;
  chapter: string | null;
  tags: string[] | null;
  priority: number;
  similarity: number;
}

export async function ragSearchKb(
  supabase: ReturnType<typeof Object>,
  query: string,
  opts: KbMatchOpts = {},
): Promise<KbMatchRow[]> {
  if (!query?.trim()) return [];
  const queryEmbedding = await embedOne(query, opts.embedOpts);
  const { data, error } = await supabase.rpc("match_kb_entries", {
    query_embedding: queryEmbedding,
    match_count: opts.matchCount ?? 8,
    match_threshold: opts.matchThreshold ?? 0.3,
    filter_categories: opts.categories ?? null,
    filter_min_priority: opts.minPriority ?? 0,
    only_active: opts.onlyActive ?? true,
  });
  if (error) {
    console.error("ragSearchKb RPC error:", error);
    return [];
  }
  return (data || []) as KbMatchRow[];
}

// ━━━ RAG Memory Search ━━━

export interface MemoryMatchOpts {
  matchCount?: number;
  matchThreshold?: number;
  filterUserId?: string;
  filterLevels?: number[];
  filterTypes?: string[];
  embedOpts?: EmbedOptions;
}

export interface MemoryMatchRow {
  id: string;
  content: string;
  memory_type: string;
  level: number;
  importance: number;
  confidence: number;
  tags: string[] | null;
  similarity: number;
}

/**
 * RAG retrieval: cerca memorie più rilevanti via match_ai_memory_enhanced RPC.
 */
export async function ragSearchMemory(
  supabase: ReturnType<typeof Object>,
  query: string,
  opts: MemoryMatchOpts = {},
): Promise<MemoryMatchRow[]> {
  if (!query?.trim() || query.trim().length < 5) return [];
  const queryEmbedding = await embedOne(query, opts.embedOpts);
  const { data, error } = await supabase.rpc("match_ai_memory_enhanced", {
    query_embedding: queryEmbedding,
    match_count: opts.matchCount ?? 15,
    match_threshold: opts.matchThreshold ?? 0.2,
    filter_user_id: opts.filterUserId ?? null,
    filter_levels: opts.filterLevels ?? null,
    filter_types: opts.filterTypes ?? null,
  });
  if (error) {
    console.error("ragSearchMemory RPC error:", error);
    return [];
  }
  return (data || []) as MemoryMatchRow[];
}

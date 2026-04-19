/**
 * rateLimiter.ts — In-memory token bucket rate limiter per edge functions.
 * Funziona per-isolate Deno Deploy: non è distribuito, ma cattura abusi
 * ripetuti sulla stessa istanza. Leggero, zero dipendenze DB.
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxTokens: 20,
  refillRate: 0.5,
  windowMs: 120_000,
};

const buckets = new Map<string, TokenBucket>();
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < windowMs) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, bucket] of buckets) {
    if (bucket.lastRefill < cutoff) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Kill-switch: per uso interno aziendale i limiti sono disattivati.
 * Riattivare in scenario commerciale settando AI_USAGE_LIMITS_ENABLED=true.
 */
function limitsEnabled(): boolean {
  return Deno.env.get("AI_USAGE_LIMITS_ENABLED") === "true";
}

export function checkRateLimit(
  key: string,
  config: Partial<RateLimitConfig> = {},
): RateLimitResult {
  if (!limitsEnabled()) {
    return { allowed: true, remaining: 999, retryAfterMs: 0 };
  }
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();

  cleanup(cfg.windowMs);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: cfg.maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(cfg.maxTokens, bucket.tokens + elapsed * cfg.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
  }

  const deficit = 1 - bucket.tokens;
  const retryAfterMs = Math.ceil((deficit / cfg.refillRate) * 1000);
  return { allowed: false, remaining: 0, retryAfterMs };
}

export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limit_exceeded",
      message: "Troppe richieste. Riprova tra qualche secondo.",
      retry_after_ms: result.retryAfterMs,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

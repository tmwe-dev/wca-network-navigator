/**
 * aiDirectEndpoint — Helper per chiamate AI "raw" che NON passano da aiChat()
 * (es. ai-gateway-micro proxy, parse immagini, classify deterministico).
 *
 * Ritorna URL + headers + model risolvendo via ai_routing_config (per scope)
 * con fallback al default provider (anthropic) o al provider dato esplicitamente.
 *
 * IMPORTANT: per chat/completions standard usa SEMPRE aiChat() dal gateway.
 * Questo helper esiste solo per i ~5 file legacy che fanno fetch diretta.
 */

import { PROVIDER_CONFIG, MODEL_MAP, type ProviderKey } from "./aiGatewayConfig.ts";
import { resolveScopeRoute } from "./aiScopeRouter.ts";

export interface ResolvedEndpoint {
  /** Provider key (anthropic/openai/google/lovable). */
  provider: ProviderKey;
  /** Full URL to POST chat completions / messages to. */
  url: string;
  /** Native model name (already mapped). */
  model: string;
  /** API key for this provider. */
  apiKey: string;
  /** Pre-built headers (Content-Type + auth). */
  headers: Record<string, string>;
  /** True if Anthropic — caller must build /v1/messages body (NOT chat/completions). */
  isAnthropic: boolean;
  /** True if provider exposes OpenAI-compatible chat/completions. */
  isOpenAiCompatible: boolean;
}

export async function resolveAiEndpoint(opts: {
  scope?: string;
  /** Optional override: logical model name (e.g. "google/gemini-2.5-flash"). */
  fallbackModel?: string;
  /** Optional override: explicit provider. */
  forceProvider?: ProviderKey;
}): Promise<ResolvedEndpoint> {
  const route = await resolveScopeRoute(opts.scope);
  const provider: ProviderKey =
    opts.forceProvider ||
    (route?.provider as ProviderKey | undefined) ||
    ((Deno.env.get("AI_PROVIDER") as ProviderKey | undefined) ?? "anthropic");

  const config = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.anthropic;
  const apiKey =
    Deno.env.get(config.envKey) ||
    Deno.env.get("AI_API_KEY") ||
    Deno.env.get("LOVABLE_API_KEY") ||
    "";
  if (!apiKey) {
    throw new Error(`${config.envKey} not configured for provider '${provider}'`);
  }

  const logicalModel = route?.model || opts.fallbackModel || "google/gemini-3-flash-preview";
  const nativeModel = MODEL_MAP[provider]?.[logicalModel] || logicalModel;

  const isAnthropic = provider === "anthropic";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isAnthropic) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = config.authHeader(apiKey);
  }

  return {
    provider,
    url: config.url,
    model: nativeModel,
    apiKey,
    headers,
    isAnthropic,
    isOpenAiCompatible: !isAnthropic,
  };
}
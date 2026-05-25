/**
 * aiProviderResolver.ts — AI provider resolution and credit consumption.
 *
 * Handles:
 * - User vs. system API key resolution
 * - Determining model endpoints
 * - Credit consumption tracking
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface ResolvedAiProvider {
  url: string;
  apiKey: string;
  model: string;
  isUserKey: boolean;
}

type OpenAiCompatibleProvider = "openai" | "google" | "openrouter" | "grok" | "qwen";

const OPENAI_COMPATIBLE_PROVIDERS: readonly OpenAiCompatibleProvider[] = [
  "openai",
  "google",
  "openrouter",
  "grok",
  "qwen",
];

const PROVIDER_SETTINGS: Record<OpenAiCompatibleProvider, { envKey: string; url: string; model: string }> = {
  openai: {
    envKey: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  google: {
    envKey: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
  },
  openrouter: {
    envKey: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.5-flash",
  },
  grok: {
    envKey: "GROK_API_KEY",
    url: "https://api.x.ai/v1/chat/completions",
    model: "grok-3-mini-fast",
  },
  qwen: {
    envKey: "QWEN_API_KEY",
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-turbo",
  },
};

function normalizeProvider(raw: string | undefined): OpenAiCompatibleProvider | null {
  const value = (raw ?? "").trim().toLowerCase();
  return (OPENAI_COMPATIBLE_PROVIDERS as readonly string[]).includes(value)
    ? (value as OpenAiCompatibleProvider)
    : null;
}

function providerFromEnv(provider: OpenAiCompatibleProvider): ResolvedAiProvider | null {
  const cfg = PROVIDER_SETTINGS[provider];
  const apiKey = Deno.env.get(cfg.envKey);
  if (!apiKey) return null;
  return { url: cfg.url, apiKey, model: cfg.model, isUserKey: true };
}

export async function resolveAiProvider(supabase: SupabaseClient, userId: string): Promise<ResolvedAiProvider> {
  const { data: userKeys } = await supabase
    .from("user_api_keys")
    .select("provider, api_key")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (userKeys && userKeys.length > 0) {
    const googleKey = (userKeys as Record<string, unknown>[]).find((k) => k.provider === "google");
    if (googleKey?.api_key) {
      return { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: googleKey.api_key as string, model: "gemini-2.5-flash", isUserKey: true };
    }
    const openaiKey = (userKeys as Record<string, unknown>[]).find((k) => k.provider === "openai");
    if (openaiKey?.api_key) {
      return { url: "https://api.openai.com/v1/chat/completions", apiKey: openaiKey.api_key as string, model: "gpt-5-mini", isUserKey: true };
    }
  }

  // Global override via AI_PROVIDER env var (case/space tolerant).
  // ai-assistant usa un payload OpenAI-compatible: scegliamo solo provider con
  // endpoint chat/completions compatibile. Se AI_PROVIDER è assente o non valido,
  // preferiamo comunque una chiave utente configurata prima di Lovable AI.
  const preferredProvider = normalizeProvider(Deno.env.get("AI_PROVIDER"));
  if (preferredProvider) {
    const configured = providerFromEnv(preferredProvider);
    if (configured) return configured;
  }

  for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
    if (provider === preferredProvider) continue;
    const configured = providerFromEnv(provider);
    if (configured) return configured;
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: LOVABLE_API_KEY, model: "google/gemini-3-flash-preview", isUserKey: false };
}

export async function consumeCredits(supabase: SupabaseClient, userId: string, usage: { prompt_tokens?: number; completion_tokens?: number }, isUserKey: boolean): Promise<void> {
  if (isUserKey) return;
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  if (inputTokens === 0 && outputTokens === 0) return;
  const rates = { input: 1, output: 2 };
  const totalCredits = Math.ceil(inputTokens / 1000 * rates.input) + Math.ceil(outputTokens / 1000 * rates.output);
  if (totalCredits <= 0) return;
  const { data: deductResult } = await supabase.rpc("deduct_credits", {
    p_user_id: userId, p_amount: totalCredits, p_operation: "ai_call",
    p_description: `AI Assistant: ${inputTokens} in + ${outputTokens} out tokens (${totalCredits} crediti)`,
  });
  const row = (deductResult as Record<string, unknown>[] | null)?.[0];
  // Credits deducted: totalCredits, row.success indicates if deduction was successful, row.new_balance is the updated balance
}

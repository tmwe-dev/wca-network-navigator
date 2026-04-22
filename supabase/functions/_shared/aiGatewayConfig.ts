/**
 * aiGatewayConfig — Provider configuration, model mapping, and allowed models.
 *
 * Extracted from aiGateway.ts for maintainability.
 * Add new providers or model mappings here.
 */

export type ProviderKey = "lovable" | "openrouter" | "openai" | "anthropic" | "google" | "grok" | "qwen";

export interface ProviderEntry {
  url: string;
  authHeader: (key: string) => string;
}

export const PROVIDER_CONFIG: Record<ProviderKey, ProviderEntry> = {
  lovable: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    authHeader: (key) => key,
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  grok: {
    url: "https://api.x.ai/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  qwen: {
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
};

export const MODEL_MAP: Record<string, Record<string, string>> = {
  lovable: {},
  openrouter: {},
  openai: {
    "openai/gpt-5-mini": "gpt-4o-mini",
    "openai/gpt-5": "gpt-4o",
    "openai/gpt-5-nano": "gpt-4o-mini",
    "google/gemini-2.5-flash": "gpt-4o-mini",
    "google/gemini-2.5-flash-lite": "gpt-4o-mini",
    "google/gemini-3-flash-preview": "gpt-4o",
  },
  anthropic: {
    "google/gemini-3-flash-preview": "claude-sonnet-4-20250514",
    "openai/gpt-5": "claude-sonnet-4-20250514",
    "google/gemini-2.5-flash": "claude-haiku-4-20250514",
    "google/gemini-2.5-flash-lite": "claude-haiku-4-20250514",
    "openai/gpt-5-mini": "claude-haiku-4-20250514",
    "openai/gpt-5-nano": "claude-haiku-4-20250514",
  },
  google: {
    "google/gemini-2.5-flash": "gemini-2.5-flash",
    "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "google/gemini-3-flash-preview": "gemini-2.5-flash",
    "openai/gpt-5": "gemini-2.5-flash",
    "openai/gpt-5-mini": "gemini-2.5-flash-lite",
    "openai/gpt-5-nano": "gemini-2.5-flash-lite",
  },
  grok: {
    "google/gemini-2.5-flash": "grok-3-mini-fast",
    "google/gemini-2.5-flash-lite": "grok-3-mini-fast",
    "google/gemini-3-flash-preview": "grok-3-mini-fast",
    "openai/gpt-5": "grok-3-mini-fast",
    "openai/gpt-5-mini": "grok-3-mini-fast",
    "openai/gpt-5-nano": "grok-3-mini-fast",
  },
  qwen: {
    "google/gemini-3-flash-preview": "qwen-plus",
    "openai/gpt-5": "qwen-plus",
    "google/gemini-2.5-flash": "qwen-turbo",
    "google/gemini-2.5-flash-lite": "qwen-turbo",
    "openai/gpt-5-mini": "qwen-turbo",
    "openai/gpt-5-nano": "qwen-turbo",
  },
};

/** Known model names (warning-only if not in set). */
export const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "openai/gpt-5-mini",
  "openai/gpt-5",
  "openai/gpt-5-nano",
]);

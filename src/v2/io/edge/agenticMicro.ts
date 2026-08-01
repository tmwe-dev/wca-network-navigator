/**
 * agenticMicro — client per la edge function ai-gateway-micro.
 *
 * Endpoint minimale: zero context assembly, zero doctrine, zero memoria.
 * Pensato per le micro-call dell'Armonizzatore V2 (~2K input / ~300 output token).
 */
import { supabase } from "@/integrations/supabase/client";

export interface MicroCallInput {
  system: string;
  user: string;
  /** Default: google/gemini-2.5-flash */
  model?: string;
  /** Default: 1024 */
  max_tokens?: number;
  /** Default: 0.1 */
  temperature?: number;
}

/**
 * Invoca la edge function ai-gateway-micro e ritorna il TESTO RAW del modello.
 * Caller responsabile di parsing/validazione.
 */
export async function invokeAgenticMicroCall(input: MicroCallInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-gateway-micro", {
    body: {
      system: input.system,
      user: input.user,
      model: input.model ?? "google/gemini-2.5-flash",
      max_tokens: input.max_tokens ?? 1024,
      temperature: input.temperature ?? 0.1,
    },
  });

  if (error) {
    throw new Error(`ai-gateway-micro failed: ${error.message}`);
  }

  if (!data || typeof data !== "object") {
    throw new Error("ai-gateway-micro: empty response");
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.error === "string") {
    throw new Error(`ai-gateway-micro: ${obj.error}`);
  }

  const content = obj.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("ai-gateway-micro: missing content in response");
  }

  return content;
}

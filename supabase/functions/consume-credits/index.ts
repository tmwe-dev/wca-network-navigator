import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

const SUPPORTED_PROVIDERS = ["openai", "google", "anthropic"] as const;
type Provider = typeof SUPPORTED_PROVIDERS[number];

const CREDITS_PER_1K: Record<Provider, { input: number; output: number }> = {
  openai: { input: 1, output: 4 },
  google: { input: 1, output: 2 },
  anthropic: { input: 1, output: 5 },
};

function isValidProvider(p: string): p is Provider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(p);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: dynCors });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return edgeError("AUTH_REQUIRED", "No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) return edgeError("AUTH_INVALID", `Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) return edgeError("AUTH_REQUIRED", "User not authenticated");

    const { provider, input_tokens, output_tokens } = await req.json();

    if (!provider || (!input_tokens && !output_tokens)) {
      return edgeError("VALIDATION_ERROR", "provider, input_tokens or output_tokens required");
    }

    if (!isValidProvider(provider)) {
      return edgeError("VALIDATION_ERROR", `Unknown provider: ${provider}. Supported: ${SUPPORTED_PROVIDERS.join(", ")}`);
    }

    // Check if user has their own API key for this provider
    const { data: apiKey } = await supabaseAdmin
      .from("user_api_keys")
      .select("api_key, is_active")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("is_active", true)
      .maybeSingle();

    if (apiKey?.api_key) {
      return new Response(JSON.stringify({
        allowed: true,
        byok: true,
        credits_consumed: 0,
        message: "Using your own API key - no credits consumed",
      }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate credit cost
    const rates = CREDITS_PER_1K[provider];
    const inputCost = Math.ceil((input_tokens || 0) / 1000 * rates.input);
    const outputCost = Math.ceil((output_tokens || 0) / 1000 * rates.output);
    const totalCredits = inputCost + outputCost;

    // Atomic credit deduction using DB function
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: totalCredits,
      p_operation: "ai_call",
      p_description: `${provider}: ${input_tokens || 0} input + ${output_tokens || 0} output tokens`,
    });

    if (deductError) return edgeError("INTERNAL_ERROR", extractErrorMessage(deductError));

    const row = (deductResult as Array<{ success: boolean; new_balance: number }>)?.[0];
    if (!row?.success) {
      return new Response(JSON.stringify({
        allowed: false,
        byok: false,
        credits_consumed: 0,
        balance: row?.new_balance || 0,
        required: totalCredits,
        message: "Crediti insufficienti. Acquista crediti extra o aggiungi le tue chiavi API.",
      }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({
      allowed: true,
      byok: false,
      credits_consumed: totalCredits,
      balance: row.new_balance,
      message: `${totalCredits} crediti consumati`,
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: unknown) {
    return edgeError("INTERNAL_ERROR", extractErrorMessage(e));
  }
});

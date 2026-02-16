import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { provider, input_tokens, output_tokens } = await req.json();
    if (!provider || (!input_tokens && !output_tokens)) {
      throw new Error("provider, input_tokens or output_tokens required");
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
      // BYOK: no credits consumed
      return new Response(JSON.stringify({
        allowed: true,
        byok: true,
        credits_consumed: 0,
        message: "Using your own API key - no credits consumed",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate credit cost
    const CREDITS_PER_1K: Record<string, { input: number; output: number }> = {
      openai: { input: 1, output: 4 },
      google: { input: 1, output: 2 },
      anthropic: { input: 1, output: 5 },
    };

    const rates = CREDITS_PER_1K[provider];
    if (!rates) throw new Error(`Unknown provider: ${provider}`);

    const inputCost = Math.ceil((input_tokens || 0) / 1000 * rates.input);
    const outputCost = Math.ceil((output_tokens || 0) / 1000 * rates.output);
    const totalCredits = inputCost + outputCost;

    // Check balance
    const { data: credits } = await supabaseAdmin
      .from("user_credits")
      .select("balance, total_consumed")
      .eq("user_id", user.id)
      .single();

    if (!credits || credits.balance < totalCredits) {
      return new Response(JSON.stringify({
        allowed: false,
        byok: false,
        credits_consumed: 0,
        balance: credits?.balance || 0,
        required: totalCredits,
        message: "Crediti insufficienti. Acquista crediti extra o aggiungi le tue chiavi API.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Deduct credits
    const newBalance = credits.balance - totalCredits;
    const newConsumed = credits.total_consumed + totalCredits;

    await supabaseAdmin
      .from("user_credits")
      .update({ balance: newBalance, total_consumed: newConsumed })
      .eq("user_id", user.id);

    // Log transaction
    await supabaseAdmin
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -totalCredits,
        operation: "ai_call",
        description: `${provider}: ${input_tokens || 0} input + ${output_tokens || 0} output tokens`,
      });

    return new Response(JSON.stringify({
      allowed: true,
      byok: false,
      credits_consumed: totalCredits,
      balance: newBalance,
      message: `${totalCredits} crediti consumati`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

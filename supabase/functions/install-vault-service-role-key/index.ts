// One-shot bootstrap: copies SUPABASE_SERVICE_ROLE_KEY (already injected by
// the Supabase runtime) into Vault as 'funnemail_trigger_service_role_key'.
// No parameters, no user input, no secret leakage. Idempotent.
// After confirming the trigger works, this function can be deleted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "service_key_not_in_env" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.rpc("install_funnemail_vault_key", { p_value: serviceKey });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true, vault_id: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

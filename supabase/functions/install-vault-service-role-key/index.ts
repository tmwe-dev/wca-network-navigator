// One-shot bootstrap + verifier.
// POST without query: re-stores SERVICE_ROLE_KEY into Vault.
// POST ?verify=1: returns whether Vault value matches the runtime env (byte-for-byte).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!serviceKey) {
    return edgeErrorWithStatus("INTERNAL_ERROR", "service_key_not_in_env", 500, {
      ...corsHeaders,
      "Content-Type": "application/json",
    });
  }

  const admin = createClient(url, serviceKey);
  const u = new URL(req.url);

  if (u.searchParams.get("verify") === "1") {
    const { data, error } = await admin.rpc("compare_funnemail_vault_key", { p_value: serviceKey });
    if (error)
      return edgeErrorWithStatus("INTERNAL_ERROR", error.message, 500, {
        ...corsHeaders,
        "Content-Type": "application/json",
      });
    return new Response(JSON.stringify({ ok: true, ...data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await admin.rpc("install_funnemail_vault_key", { p_value: serviceKey });
  if (error)
    return edgeErrorWithStatus("INTERNAL_ERROR", error.message, 500, {
      ...corsHeaders,
      "Content-Type": "application/json",
    });
  return new Response(JSON.stringify({ ok: true, vault_id: data, env_len: serviceKey.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

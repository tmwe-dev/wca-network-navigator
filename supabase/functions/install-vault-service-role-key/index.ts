// One-shot bootstrap: stores SUPABASE_SERVICE_ROLE_KEY into Vault as
// 'funnemail_trigger_service_role_key' so the on_inbound_message trigger
// can authenticate against classify-inbound-message via pg_net.
// Admin-only. Idempotent (updates if already present).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth: must be a logged-in admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId || userErr) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(url, serviceKey);
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: "admin_only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Upsert into Vault via raw SQL (vault.create_secret/update_secret)
  const { data: existing, error: selErr } = await admin.rpc("install_funnemail_vault_key", { p_value: serviceKey });
  if (selErr) {
    return new Response(JSON.stringify({ error: selErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true, vault_id: existing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

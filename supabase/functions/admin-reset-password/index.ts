import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  const { email, new_password } = await req.json();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Find user by email
  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) return new Response(JSON.stringify({ error: listErr.message }), { status: 500 });

  const user = users.find((u) => u.email === email);
  if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

  // Update password
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: new_password });
  if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });

  return new Response(JSON.stringify({ success: true, user_id: user.id }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});

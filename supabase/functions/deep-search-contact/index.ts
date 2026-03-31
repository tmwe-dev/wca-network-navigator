/**
 * DEPRECATED — Deep Search Contact
 * This edge function has been replaced by client-side Deep Search via Partner Connect extension.
 * Kept for backward compatibility. Returns deprecation notice.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: 'DEPRECATED: Deep Search now runs client-side via Partner Connect extension. Install the extension and use the app directly.',
      deprecated: true,
      replacement: 'Partner Connect extension (client-side)',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})

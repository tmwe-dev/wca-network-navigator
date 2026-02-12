import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { cookie } = await req.json()
    if (!cookie || typeof cookie !== 'string') {
      return new Response(JSON.stringify({ success: false, message: 'Cookie mancante' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()

    await supabase.from('app_settings').upsert(
      { key: 'ra_session_cookie', value: cookie, updated_at: now },
      { onConflict: 'key' }
    )

    await supabase.from('app_settings').upsert(
      { key: 'ra_session_status', value: 'ok', updated_at: now },
      { onConflict: 'key' }
    )

    await supabase.from('app_settings').upsert(
      { key: 'ra_session_checked_at', value: now, updated_at: now },
      { onConflict: 'key' }
    )

    console.log(`save-ra-cookie: saved (${cookie.length} chars)`)

    return new Response(JSON.stringify({
      success: true,
      message: '✅ Cookie ReportAziende salvato!',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('save-ra-cookie error:', error)
    return new Response(JSON.stringify({
      success: false,
      message: 'Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto'),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

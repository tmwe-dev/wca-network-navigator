import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const { cookie } = await req.json()
    if (!cookie || typeof cookie !== 'string') {
      return respond({ success: false, message: 'Cookie li_at mancante' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date().toISOString()

    console.log(`save-linkedin-cookie: received li_at (${cookie.length} chars)`)

    await supabase.from('app_settings').upsert(
      { key: 'linkedin_li_at', value: cookie, updated_at: now },
      { onConflict: 'key' }
    )

    await supabase.from('app_settings').upsert(
      { key: 'linkedin_session_status', value: 'ok', updated_at: now },
      { onConflict: 'key' }
    )
    await supabase.from('app_settings').upsert(
      { key: 'linkedin_session_checked_at', value: now, updated_at: now },
      { onConflict: 'key' }
    )

    return respond({ success: true, message: '✅ Cookie li_at salvato!' })
  } catch (error) {
    console.error('save-linkedin-cookie error:', error)
    return respond(
      { success: false, message: 'Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto') },
      500
    )
  }
})

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(null), 'Content-Type': 'application/json' },
  })
}

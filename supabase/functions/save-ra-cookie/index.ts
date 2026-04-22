import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireExtensionAuth, isExtensionAuthError } from "../_shared/extensionAuth.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const auth = await requireExtensionAuth(req, dynCors);
  if (isExtensionAuthError(auth)) return auth;

  try {
    const { cookie } = await req.json()
    if (!cookie || typeof cookie !== 'string') {
      return new Response(JSON.stringify({ success: false, message: 'Cookie mancante' }), {
        status: 400, headers: { ...dynCors, 'Content-Type': 'application/json' },
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

    

    return new Response(JSON.stringify({
      success: true,
      message: '✅ Cookie ReportAziende salvato!',
    }), {
      headers: { ...dynCors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('save-ra-cookie error:', error)
    return new Response(JSON.stringify({
      success: false,
      message: 'Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto'),
    }), {
      status: 500, headers: { ...dynCors, 'Content-Type': 'application/json' },
    })
  }
})

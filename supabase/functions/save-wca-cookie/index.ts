import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

/**
 * Save WCA cookie to app_settings.
 * ZERO HTTP requests to WCA — only checks cookie content locally.
 * This prevents IP-mismatch session invalidation.
 */
Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // ── Soft Auth: accept both user JWT and anon key (extension uses anon key) ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return respond({ success: false, message: 'Unauthorized' }, 401)
    }
    // Cookie is a shared resource in app_settings — extension calls with anon key are valid

    const { cookie } = await req.json()
    if (!cookie || typeof cookie !== 'string') {
      return respond({ success: false, message: 'Cookie mancante' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date().toISOString()
    const hasAspxAuth = cookie.includes('.ASPXAUTH=')
    const hasWcaCookie = cookie.includes('wca=')
    const isAuthenticated = hasAspxAuth || hasWcaCookie

    console.log(`save-wca-cookie: received cookie (${cookie.length} chars), hasAspxAuth=${hasAspxAuth}, hasWcaCookie=${hasWcaCookie}`)

    // Save cookie to both keys for compatibility
    await supabase.from('app_settings').upsert(
      { key: 'wca_auth_cookie', value: cookie, updated_at: now },
      { onConflict: 'key' }
    )
    await supabase.from('app_settings').upsert(
      { key: 'wca_session_cookie', value: cookie, updated_at: now },
      { onConflict: 'key' }
    )

    // Determine status ONLY from cookie content — NO HTTP requests to WCA
    // If .ASPXAUTH is missing (likely HttpOnly), mark as "unknown" — real verification via extension will confirm
    const status = isAuthenticated ? 'ok' : 'unknown'

    await supabase.from('app_settings').upsert(
      { key: 'wca_session_status', value: status, updated_at: now },
      { onConflict: 'key' }
    )
    await supabase.from('app_settings').upsert(
      { key: 'wca_session_checked_at', value: now, updated_at: now },
      { onConflict: 'key' }
    )

    const message = isAuthenticated
      ? '✅ Cookie salvato! Sessione WCA attiva.'
      : '⏳ Cookie salvato. Nessun cookie di autenticazione rilevato, verifica reale necessaria.'

    console.log(`save-wca-cookie: status=${status}, message=${message}`)

    return respond({
      success: true,
      authenticated: isAuthenticated,
      hasAspxAuth,
      hasWcaCookie,
      message,
    })
  } catch (error) {
    console.error('save-wca-cookie error:', error)
    return respond(
      { success: false, message: 'Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto') },
      500
    )
  }
})

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...dynCors, 'Content-Type': 'application/json' },
  })
}

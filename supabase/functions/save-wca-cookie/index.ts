import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireExtensionAuth, isExtensionAuthError } from "../_shared/extensionAuth.ts";

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
    // P1.2: enforce extension auth (JWT preferred, anon-key only as legacy fallback
    // and ONLY from CORS-whitelisted origins — getCorsHeaders already gates this).
    const auth = await requireExtensionAuth(req, dynCors);
    if (isExtensionAuthError(auth)) return auth;

    const { cookie } = await req.json()
    if (!cookie || typeof cookie !== 'string') {
      return respond({ success: false, message: 'Cookie mancante' }, 400)
    }
    if (cookie.length > 20000) {
      return respond({ success: false, message: 'Cookie troppo lungo' }, 413)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date().toISOString()
    const hasAspxAuth = cookie.includes('.ASPXAUTH=')
    const hasWcaCookie = cookie.includes('wca=')
    const isAuthenticated = hasAspxAuth || hasWcaCookie

    

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

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(null), 'Content-Type': 'application/json' },
  })
}

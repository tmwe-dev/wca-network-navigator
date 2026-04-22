import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireExtensionAuth, isExtensionAuthError } from "../_shared/extensionAuth.ts";
import { encryptValue } from "../_shared/linkedinCrypto.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const auth = await requireExtensionAuth(req, dynCors);
  if (isExtensionAuthError(auth)) return auth;

  try {
    const { cookie } = await req.json()
    // FIX G6 — strict cookie format validation
    if (
      !cookie ||
      typeof cookie !== 'string' ||
      cookie.length < 20 ||
      cookie.length > 500 ||
      /[<>"']/.test(cookie)
    ) {
      return respond({ success: false, message: 'Cookie format invalid' }, 400, dynCors)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()

    // FIX G4 — no length/content logging
    

    // FIX G1 — encrypt cookie before persisting
    const encryptedCookie = await encryptValue(cookie)

    await supabase.from('app_settings').upsert(
      { key: 'linkedin_li_at', value: encryptedCookie, updated_at: now },
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

    return respond({ success: true, message: '✅ Cookie li_at salvato!' }, 200, dynCors)
  } catch (error) {
    console.error('save-linkedin-cookie error:', error)
    return respond(
      { success: false, message: 'Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto') },
      500, dynCors
    )
  }
})

function respond(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...(headers || getCorsHeaders(null)), 'Content-Type': 'application/json' },
  })
}

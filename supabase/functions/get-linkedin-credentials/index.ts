import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { edgeError, extractErrorMessage } from '../_shared/handleEdgeError.ts'
import { getCorsHeaders, corsPreflight } from '../_shared/cors.ts'
import { decryptValue } from '../_shared/linkedinCrypto.ts'

interface AppSettingRow {
  key: string;
  value: string | null;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return edgeError('AUTH_REQUIRED', 'Unauthorized')
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Identify user from JWT
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return edgeError('AUTH_INVALID', 'Invalid or expired token')
    }

    // FIX G5 — Rate limit: max 5 requests / minute per user
    const now = Date.now()
    const windowMs = 60_000
    const maxRequests = 5
    const { data: rateRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', 'linkedin_creds_rate')
      .maybeSingle()

    let rateData: { count: number; window_start: number } = { count: 0, window_start: now }
    if (rateRow?.value) {
      try { rateData = JSON.parse(rateRow.value) } catch { /* ignore */ }
    }
    if (now - rateData.window_start < windowMs) {
      if (rateData.count >= maxRequests) {
        return new Response(
          JSON.stringify({ error: 'Too many credential requests. Try again in 1 minute.' }),
          { status: 429, headers: { ...dynCors, 'Content-Type': 'application/json' } },
        )
      }
      rateData.count += 1
    } else {
      rateData = { count: 1, window_start: now }
    }
    await supabase.from('app_settings').upsert(
      { user_id: user.id, key: 'linkedin_creds_rate', value: JSON.stringify(rateData), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    )

    // Fetch credentials scoped to authenticated user
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('user_id', user.id)
      .in('key', ['linkedin_email', 'linkedin_password'])

    if (error) throw error

    // FIX G2 — decrypt with migration fallback for legacy plaintext values
    const settings: Record<string, string> = {}
    for (const row of (data as AppSettingRow[] | null) ?? []) {
      if (!row.value) continue
      try {
        settings[row.key] = await decryptValue(row.value)
      } catch {
        settings[row.key] = row.value
      }
    }

    if (!settings['linkedin_email'] && !settings['linkedin_password']) {
      return edgeError('NOT_FOUND', 'LinkedIn credentials not configured')
    }

    return new Response(JSON.stringify({
      email: settings['linkedin_email'] || '',
      password: settings['linkedin_password'] || '',
    }), {
      headers: { ...dynCors, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    console.error('get-linkedin-credentials error:', e)
    return edgeError('INTERNAL_ERROR', extractErrorMessage(e))
  }
})

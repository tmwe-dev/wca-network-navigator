import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Check WCA session status.
 * 
 * Two modes:
 * 1. Direct status update: body contains { status, source } — frontend confirmed via extension
 * 2. DB-only check: no body or empty — checks cookie string and job history (fallback)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Parse body if present
    let body: any = null
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { /* empty body is fine */ }

    // MODE 1: Direct status update from frontend (extension verified)
    if (body?.status && body?.source) {
      const status = body.status === 'ok' ? 'ok' : 'expired'
      await upsertStatus(supabase, status, new Date().toISOString())
      return respond({
        authenticated: status === 'ok',
        status,
        source: body.source,
        method: 'direct_update',
        checkedAt: new Date().toISOString(),
      })
    }

    // MODE 2: DB-only check (fallback when extension is not available)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value, updated_at')
      .in('key', ['wca_session_cookie', 'wca_auth_cookie', 'wca_session_status'])

    const map: Record<string, string> = {}
    const timestamps: Record<string, string> = {}
    for (const s of (settings || [])) {
      if (s.key && s.value) map[s.key] = s.value
      if (s.key) timestamps[s.key] = s.updated_at
    }

    const cookie = map['wca_auth_cookie'] || map['wca_session_cookie'] || Deno.env.get('WCA_SESSION_COOKIE') || null
    const cookieUpdatedAt = timestamps['wca_auth_cookie'] || timestamps['wca_session_cookie'] || null

    if (!cookie) {
      await upsertStatus(supabase, 'no_cookie', new Date().toISOString())
      return respond({ authenticated: false, status: 'no_cookie' })
    }

    const hasAspxAuth = cookie.includes('.ASPXAUTH=')

    // Check recent job activity for signs of session death
    const { data: recentJobs } = await supabase
      .from('download_jobs')
      .select('status, contacts_found_count, contacts_missing_count, error_message, updated_at')
      .in('status', ['running', 'completed', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(1)

    let status = 'ok'
    let jobSignal: string | null = null

    // If no .ASPXAUTH but cookie exists, check if recent jobs worked fine
    if (!hasAspxAuth) {
      // Check if a recent successful job suggests the session is actually working
      if (recentJobs && recentJobs.length > 0) {
        const job = recentJobs[0]
        if (job.status === 'completed' && job.contacts_found_count > 0) {
          // Jobs completed successfully — session likely works despite missing .ASPXAUTH string
          status = 'ok'
          jobSignal = 'aspxauth_missing_but_jobs_ok'
        } else if (job.status === 'paused' && job.error_message?.includes('consecutivi senza contatti')) {
          status = 'expired'
          jobSignal = 'job_paused_empty_profiles'
        } else {
          // No clear signal — mark as expired (conservative)
          status = 'expired'
          jobSignal = 'no_aspxauth_no_clear_signal'
        }
      } else {
        // No jobs at all — can't determine, mark expired
        status = 'expired'
        jobSignal = 'no_aspxauth_no_jobs'
      }
    } else {
      // Has .ASPXAUTH — check job signals
      if (recentJobs && recentJobs.length > 0) {
        const job = recentJobs[0]
        if (job.status === 'paused' && job.error_message?.includes('consecutivi senza contatti')) {
          if (cookieUpdatedAt && new Date(cookieUpdatedAt) > new Date(job.updated_at)) {
            status = 'ok'
            jobSignal = 'job_paused_but_cookie_refreshed'
          } else {
            status = 'expired'
            jobSignal = 'job_paused_empty_profiles'
          }
        }
      }
    }

    const authenticated = status === 'ok'
    await upsertStatus(supabase, status, new Date().toISOString())

    return respond({
      authenticated,
      status,
      checkedAt: new Date().toISOString(),
      hasAspxAuth,
      jobSignal,
      method: 'db_only',
    })
  } catch (error) {
    console.error('check-wca-session error:', error)
    return respond(
      { authenticated: false, reason: 'error', error: error instanceof Error ? error.message : 'Unknown' },
      500
    )
  }
})

async function upsertStatus(supabase: any, status: string, checkedAt: string) {
  const now = new Date().toISOString()
  await supabase.from('app_settings').upsert(
    { key: 'wca_session_status', value: status, updated_at: now },
    { onConflict: 'key' }
  )
  await supabase.from('app_settings').upsert(
    { key: 'wca_session_checked_at', value: checkedAt, updated_at: now },
    { onConflict: 'key' }
  )
}

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

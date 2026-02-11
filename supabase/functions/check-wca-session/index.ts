import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Check WCA session status WITHOUT making any HTTP requests to WCA.
 * This prevents IP-mismatch session invalidation.
 * 
 * Status is determined from:
 * 1. Presence of .ASPXAUTH in stored cookie
 * 2. Recent download job results (contacts found vs missing)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Read cookie from app_settings (include updated_at to compare timestamps)
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

    if (!hasAspxAuth) {
      await upsertStatus(supabase, 'expired', new Date().toISOString())
      return respond({ authenticated: false, status: 'expired', reason: 'no_aspxauth_in_cookie' })
    }

    // Check recent job activity for signs of session death
    const { data: recentJobs } = await supabase
      .from('download_jobs')
      .select('status, contacts_found_count, contacts_missing_count, error_message, updated_at')
      .in('status', ['running', 'completed', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(1)

    let status = 'ok'
    let jobSignal: string | null = null

    if (recentJobs && recentJobs.length > 0) {
      const job = recentJobs[0]
      
      if (job.status === 'paused' && job.error_message?.includes('consecutivi senza contatti')) {
        // Only mark expired if cookie was saved BEFORE the job paused
        // If cookie was refreshed AFTER the job pause, the session is likely restored
        if (cookieUpdatedAt && new Date(cookieUpdatedAt) > new Date(job.updated_at)) {
          // Cookie is fresher than the paused job — session is OK
          status = 'ok'
          jobSignal = 'job_paused_but_cookie_refreshed'
        } else {
          status = 'expired'
          jobSignal = 'job_paused_empty_profiles'
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
      method: 'db_only', // No HTTP requests to WCA
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

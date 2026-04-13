import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { edgeError, extractErrorMessage } from '../_shared/handleEdgeError.ts'
import { dynCors } from '../_shared/cors.ts'

interface AppSettingRow {
  key: string;
  value: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: dynCors })
  }

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

    // Fetch credentials scoped to authenticated user
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('user_id', user.id)
      .in('key', ['ra_username', 'ra_password'])

    if (error) throw error

    const settings: Record<string, string> = {}
    ;(data as AppSettingRow[] | null)?.forEach((row) => { if (row.value) settings[row.key] = row.value })

    if (!settings['ra_username'] && !settings['ra_password']) {
      return edgeError('NOT_FOUND', 'RA credentials not configured')
    }

    return new Response(JSON.stringify({
      username: settings['ra_username'] || '',
      password: settings['ra_password'] || '',
    }), {
      headers: { ...dynCors, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    console.error('get-ra-credentials error:', e)
    return edgeError('INTERNAL_ERROR', extractErrorMessage(e))
  }
})

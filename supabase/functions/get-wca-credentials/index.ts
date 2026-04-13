import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { edgeError, extractErrorMessage } from '../_shared/handleEdgeError.ts'
import { dynCors } from '../_shared/cors.ts'

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

    // Strict auth: identify user from JWT
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    
    if (authError || !user) {
      return edgeError('AUTH_INVALID', 'Invalid or expired token')
    }

    // Fetch per-user credentials only (no global fallback)
    const { data: userCreds } = await supabase
      .from('user_wca_credentials')
      .select('wca_username, wca_password')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userCreds?.wca_username && userCreds?.wca_password) {
      const { data: decrypted } = await supabase.rpc('decrypt_wca_password', { p_encrypted: userCreds.wca_password })
      return new Response(JSON.stringify({
        username: userCreds.wca_username,
        password: decrypted || '',
      }), {
        headers: { ...dynCors, 'Content-Type': 'application/json' },
      })
    }

    return edgeError('NOT_FOUND', 'No WCA credentials configured for this user')
  } catch (e: unknown) {
    console.error('get-wca-credentials error:', e)
    return edgeError('INTERNAL_ERROR', extractErrorMessage(e))
  }
})

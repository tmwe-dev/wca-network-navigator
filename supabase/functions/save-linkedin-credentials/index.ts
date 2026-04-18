// FIX G3 — Server-side encryption endpoint for LinkedIn email/password.
// The frontend MUST call this instead of writing linkedin_email / linkedin_password
// directly to app_settings, so credentials are never persisted in plaintext.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { edgeError, extractErrorMessage } from '../_shared/handleEdgeError.ts'
import { getCorsHeaders, corsPreflight } from '../_shared/cors.ts'
import { encryptValue } from '../_shared/linkedinCrypto.ts'

Deno.serve(async (req) => {
  const pre = corsPreflight(req)
  if (pre) return pre
  const origin = req.headers.get('origin')
  const dynCors = getCorsHeaders(origin)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return edgeError('AUTH_REQUIRED', 'Unauthorized')
    }
    const token = authHeader.replace('Bearer ', '')

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return edgeError('AUTH_INVALID', 'Invalid or expired token')
    }

    const body = await req.json().catch(() => ({})) as { email?: string; password?: string }
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    // Validation
    if (email && (!email.includes('@') || email.length > 320)) {
      return new Response(
        JSON.stringify({ error: 'Email non valida' }),
        { status: 400, headers: { ...dynCors, 'Content-Type': 'application/json' } },
      )
    }
    if (password && (password.length < 4 || password.length > 256)) {
      return new Response(
        JSON.stringify({ error: 'Password troppo corta o troppo lunga' }),
        { status: 400, headers: { ...dynCors, 'Content-Type': 'application/json' } },
      )
    }
    if (!email && !password) {
      return new Response(
        JSON.stringify({ error: 'Nothing to save' }),
        { status: 400, headers: { ...dynCors, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const now = new Date().toISOString()

    if (email) {
      await supabase.from('app_settings').upsert(
        { user_id: user.id, key: 'linkedin_email', value: await encryptValue(email), updated_at: now },
        { onConflict: 'user_id,key' },
      )
    }
    if (password) {
      await supabase.from('app_settings').upsert(
        { user_id: user.id, key: 'linkedin_password', value: await encryptValue(password), updated_at: now },
        { onConflict: 'user_id,key' },
      )
    }

    console.log('save-linkedin-credentials: stored encrypted credentials for user', user.id)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...dynCors, 'Content-Type': 'application/json' } },
    )
  } catch (e: unknown) {
    console.error('save-linkedin-credentials error:', e)
    return edgeError('INTERNAL_ERROR', extractErrorMessage(e))
  }
})

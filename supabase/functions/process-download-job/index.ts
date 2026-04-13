import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

/**
 * Download job progress tracker.
 * NO HTTP requests to WCA — the frontend + Chrome Extension handle all scraping.
 * This function only manages job state (status, completion, verification).
 */
Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // ── Auth check ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return respond({ success: false, error: 'Unauthorized' }, 401)
    }
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData?.user?.id) {
      return respond({ success: false, error: 'Unauthorized' }, 401)
    }

    const { jobId, action } = await req.json()

    if (!jobId) {
      return respond({ success: false, error: 'jobId is required' }, 400)
    }

    // Fetch the job
    const { data: job, error: jobError } = await supabase
      .from('download_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return respond({ success: false, error: `Job not found: ${jobError?.message}` })
    }

    // Action: mark job as completed
    if (action === 'complete') {
      await supabase
        .from('download_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', jobId)

      await verifyDownloadCompleteness(supabase, job.country_code, job.network_name)
      await updateNetworkConfigsFromData(supabase, job.network_name)

      return respond({ success: true, message: 'Job completed' })
    }

    // Action: get job status (for frontend polling)
    if (action === 'status') {
      return respond({
        success: true,
        status: job.status,
        current_index: job.current_index,
        total_count: job.total_count,
        contacts_found_count: job.contacts_found_count,
        contacts_missing_count: job.contacts_missing_count,
      })
    }

    // Default: return job info
    return respond({
      success: true,
      message: `Job is ${job.status}. Processing is handled by the Chrome Extension via the frontend.`,
      status: job.status,
      current_index: job.current_index,
      total_count: job.total_count,
    })

  } catch (error) {
    console.error('process-download-job error:', error)
    return respond(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(null), 'Content-Type': 'application/json' },
  })
}

/**
 * Verify that all WCA IDs in the directory_cache for a country+network
 * have been downloaded to the partners table.
 */
async function verifyDownloadCompleteness(supabase: any, countryCode: string, networkName: string) {
  try {
    const { data: cacheRows } = await supabase
      .from('directory_cache')
      .select('id, members')
      .eq('country_code', countryCode)
      .eq('network_name', networkName)

    if (!cacheRows || cacheRows.length === 0) return

    for (const cache of cacheRows) {
      const members = cache.members as Array<{ id: number }> | number[]
      if (!members || !Array.isArray(members) || members.length === 0) continue

      const wcaIds: number[] = members.map((m: any) => typeof m === 'object' ? m.id : m).filter(Boolean)
      if (wcaIds.length === 0) continue

      const { data: partners } = await supabase
        .from('partners')
        .select('wca_id')
        .in('wca_id', wcaIds)

      const foundIds = new Set((partners || []).map((p: any) => p.wca_id))
      const allPresent = wcaIds.every(id => foundIds.has(id))

      await supabase
        .from('directory_cache')
        .update({
          download_verified: allPresent,
          verified_at: allPresent ? new Date().toISOString() : null,
        })
        .eq('id', cache.id)

      console.log(`Verification for ${countryCode}/${networkName}: ${foundIds.size}/${wcaIds.length} — verified: ${allPresent}`)
    }
  } catch (err) {
    console.error('Verification error:', err)
  }
}

/**
 * Auto-update network_configs flags based on actual data in the database.
 */
async function updateNetworkConfigsFromData(supabase: any, networkName: string) {
  try {
    if (!networkName || networkName === 'Tutti' || networkName === '') return

    const netNames = networkName.includes(',') ? networkName.split(',').map(n => n.trim()) : [networkName]

    for (const net of netNames) {
      const { data: networkPartners } = await supabase
        .from('partner_networks')
        .select('partner_id')
        .eq('network_name', net)
        .limit(500)

      if (!networkPartners || networkPartners.length === 0) continue

      const partnerIds = networkPartners.map((p: any) => p.partner_id)

      const { data: contacts } = await supabase
        .from('partner_contacts')
        .select('email, direct_phone, mobile, name')
        .in('partner_id', partnerIds)

      const hasEmails = (contacts || []).some((c: any) => c.email)
      const hasPhones = (contacts || []).some((c: any) => c.direct_phone || c.mobile)
      const hasNames = (contacts || []).some((c: any) => c.name && !/Members\s*only/i.test(c.name))

      await supabase
        .from('network_configs')
        .update({
          has_contact_emails: hasEmails,
          has_contact_phones: hasPhones,
          has_contact_names: hasNames,
          sample_tested_at: new Date().toISOString(),
        })
        .eq('network_name', net)

      console.log(`Updated network_configs for "${net}": emails=${hasEmails}, phones=${hasPhones}, names=${hasNames}`)
    }
  } catch (err) {
    console.error('updateNetworkConfigsFromData error:', err)
  }
}

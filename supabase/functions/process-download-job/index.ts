import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Server-side download job processor.
 * Processes ONE WCA ID from the job, updates progress, then self-chains for the next.
 * This allows background processing that continues even if the user navigates away.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { jobId } = await req.json()

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the job
    const { data: job, error: jobError } = await supabase
      .from('download_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ success: false, error: `Job not found: ${jobError?.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if job should continue
    if (job.status === 'paused' || job.status === 'cancelled' || job.status === 'completed' || job.status === 'error') {
      return new Response(
        JSON.stringify({ success: true, message: `Job is ${job.status}, not processing` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const wcaIds: number[] = job.wca_ids || []
    const currentIndex: number = job.current_index || 0

    // Check if we're done
    if (currentIndex >= wcaIds.length) {
      await supabase
        .from('download_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', jobId)

      return new Response(
        JSON.stringify({ success: true, message: 'Job completed', total: wcaIds.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark as running
    if (job.status !== 'running') {
      await supabase
        .from('download_jobs')
        .update({ status: 'running' })
        .eq('id', jobId)
    }

    // Process the current ID by calling scrape-wca-partners
    const wcaId = wcaIds[currentIndex]
    console.log(`Job ${jobId}: Processing ID ${wcaId} (${currentIndex + 1}/${wcaIds.length})`)

    let lastCompany = ''
    try {
      const scrapeUrl = `${supabaseUrl}/functions/v1/scrape-wca-partners`
      const scrapeResponse = await fetch(scrapeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wcaId }),
      })

      const result = await scrapeResponse.json()

      if (result.success && result.found) {
        lastCompany = result.partner?.company_name || ''
      }

      // Update job progress
      const processedIds = [...(job.processed_ids || []), wcaId]
      await supabase
        .from('download_jobs')
        .update({
          current_index: currentIndex + 1,
          processed_ids: processedIds,
          last_processed_wca_id: wcaId,
          last_processed_company: lastCompany || null,
        })
        .eq('id', jobId)

    } catch (scrapeErr) {
      console.error(`Job ${jobId}: Error processing ID ${wcaId}:`, scrapeErr)
      
      // Still advance the index so we don't get stuck
      await supabase
        .from('download_jobs')
        .update({
          current_index: currentIndex + 1,
          processed_ids: [...(job.processed_ids || []), wcaId],
          last_processed_wca_id: wcaId,
          error_message: `Error on ID ${wcaId}: ${scrapeErr instanceof Error ? scrapeErr.message : 'Unknown'}`,
        })
        .eq('id', jobId)
    }

    // Self-chain: schedule the next step after the configured delay
    // Re-read job to check if it was paused/cancelled in the meantime
    const { data: freshJob } = await supabase
      .from('download_jobs')
      .select('status, delay_seconds')
      .eq('id', jobId)
      .single()

    if (freshJob && freshJob.status === 'running') {
      const delaySec = freshJob.delay_seconds || 10
      
      // Fire the next step after delay
      // We use setTimeout-like behavior by waiting, then calling ourselves
      if (currentIndex + 1 < wcaIds.length) {
        // Wait the configured delay
        await new Promise(r => setTimeout(r, delaySec * 1000))
        
        // Re-check status after delay (user might have paused during wait)
        const { data: checkJob } = await supabase
          .from('download_jobs')
          .select('status')
          .eq('id', jobId)
          .single()

        if (checkJob && checkJob.status === 'running') {
          // Chain to next step (fire and forget)
          fetch(`${supabaseUrl}/functions/v1/process-download-job`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId }),
          }).catch(err => console.error('Self-chain error:', err))
        }
      } else {
        // This was the last one
        await supabase
          .from('download_jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', jobId)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: wcaId,
        index: currentIndex + 1,
        total: wcaIds.length,
        company: lastCompany,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('process-download-job error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

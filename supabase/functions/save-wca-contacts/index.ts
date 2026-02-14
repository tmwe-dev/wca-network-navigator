import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Receives contact data extracted by the Chrome extension from the authenticated WCA DOM.
 * Updates partner_contacts with real names, personal emails, direct phones, mobiles.
 * 
 * Body: { wcaId: number, contacts: Array<{ title, name, email, phone, mobile }> }
 * Or batch: { batch: Array<{ wcaId, contacts }> }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.json()
    
    // Support both single and batch mode
    const items: Array<{ wcaId: number; contacts: any[] }> = body.batch || [body]
    const results: any[] = []

    for (const item of items) {
      const { wcaId, contacts } = item
      if (!wcaId || !contacts || !Array.isArray(contacts)) {
        results.push({ wcaId, success: false, error: 'wcaId and contacts[] required' })
        continue
      }

      // Find partner by wca_id
      const { data: partner } = await supabase
        .from('partners')
        .select('id, company_name')
        .eq('wca_id', wcaId)
        .maybeSingle()

      if (!partner) {
        results.push({ wcaId, success: false, error: 'Partner not found' })
        continue
      }

      const partnerId = partner.id
      let updated = 0
      let inserted = 0

      // --- bestEmail: pick email whose prefix matches person's surname/initial ---
      const pickBestEmail = (personName: string, emails: string[]): string | null => {
        const valid = emails.filter(e => e && /\S+@\S+\.\S+/.test(e) && !/wcaworld/i.test(e))
        if (valid.length === 0) return null
        if (valid.length === 1) return valid[0]
        const parts = personName.replace(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*/i, '').trim().split(/\s+/)
        const surname = (parts[parts.length - 1] || '').toLowerCase()
        const initial = (parts[0] || '').charAt(0).toLowerCase()
        let best = valid[0], bestScore = 0
        for (const e of valid) {
          const prefix = e.split('@')[0].toLowerCase()
          let score = 0
          if (surname && prefix.includes(surname)) score += 2
          if (initial && prefix.includes(initial)) score += 1
          if (score > bestScore) { bestScore = score; best = e }
        }
        return best
      }

      // --- Step 1: Deduplicate incoming contacts by email ---
      const dedupByEmail: any[] = []
      const seenEmails = new Map<string, number>()
      for (const c of contacts) {
        if (!c.title && !c.name) continue
        if (/Members\s*only|Login|please.*login/i.test(c.name || '')) continue
        if (/Members\s*only|Login|please.*login/i.test(c.title || '')) continue
        const emailKey = c.email?.trim().toLowerCase()
        if (emailKey && /\S+@\S+\.\S+/.test(emailKey) && seenEmails.has(emailKey)) {
          const idx = seenEmails.get(emailKey)!
          const ex = dedupByEmail[idx]
          if (c.name && !ex.name) ex.name = c.name
          if (c.phone && !ex.phone) ex.phone = c.phone
          if (c.mobile && !ex.mobile) ex.mobile = c.mobile
          if (c.title && c.title !== ex.title) ex.title = `${ex.title} / ${c.title}`
        } else {
          if (emailKey && /\S+@\S+\.\S+/.test(emailKey)) seenEmails.set(emailKey, dedupByEmail.length)
          dedupByEmail.push({ ...c, _emails: c.email ? [c.email] : [] })
        }
      }

      // --- Step 2: Deduplicate by NAME (merge same person with different emails) ---
      const deduped: any[] = []
      const seenNames = new Map<string, number>()
      for (const c of dedupByEmail) {
        const nameKey = (c.name || c.title || '').trim().toLowerCase()
        if (!nameKey) { deduped.push(c); continue }
        if (seenNames.has(nameKey)) {
          const idx = seenNames.get(nameKey)!
          const ex = deduped[idx]
          if (c.title && c.title !== ex.title && !ex.title.includes(c.title)) ex.title = `${ex.title} / ${c.title}`
          if (c.email) ex._emails.push(c.email)
          if (c.phone && !ex.phone) ex.phone = c.phone
          if (c.mobile && !ex.mobile) ex.mobile = c.mobile
        } else {
          seenNames.set(nameKey, deduped.length)
          deduped.push({ ...c, _emails: [...(c._emails || []), ...(c.email && !c._emails?.includes(c.email) ? [c.email] : [])] })
        }
      }

      // Resolve best email for each deduplicated contact
      for (const c of deduped) {
        if (c._emails && c._emails.length > 0) {
          c.email = pickBestEmail(c.name || c.title || '', c._emails)
        }
        delete c._emails
      }

      // Get existing contacts
      const { data: existing } = await supabase
        .from('partner_contacts')
        .select('id, title, name, email, direct_phone, mobile')
        .eq('partner_id', partnerId)

      // Build lookup indices (name-first priority)
      const existingByName = new Map<string, any>()
      const existingByEmail = new Map<string, any>()
      const existingByTitle = new Map<string, any>()
      for (const e of (existing || [])) {
        if (e.name) existingByName.set(e.name.trim().toLowerCase(), e)
        if (e.email) existingByEmail.set(e.email.trim().toLowerCase(), e)
        if (e.title) existingByTitle.set(e.title, e)
      }

      const usedIds = new Set<string>()

      for (const c of deduped) {
        const title = c.title || c.name || 'Unknown'
        const emailKey = c.email?.trim().toLowerCase()
        const nameKey = (c.name || '').trim().toLowerCase()

        // Match priority: name -> email -> title
        let ex = nameKey ? existingByName.get(nameKey) : undefined
        if (!ex && emailKey) ex = existingByEmail.get(emailKey)
        if (!ex) ex = existingByTitle.get(title)

        if (ex && !usedIds.has(ex.id)) {
          usedIds.add(ex.id)
          const updates: Record<string, string> = {}
          
          if (c.name && c.name !== ex.name && (!ex.name || ex.name === ex.title)) {
            updates.name = c.name
          }
          // Merge titles
          if (c.title && c.title !== ex.title && !ex.title?.includes(c.title)) {
            updates.title = ex.title ? `${ex.title} / ${c.title}` : c.title
          }
          // Email: replace if new one is a better match for the person's name
          if (c.email && /\S+@\S+\.\S+/.test(c.email)) {
            if (!ex.email) {
              updates.email = c.email
            } else if (c.email.trim().toLowerCase() !== ex.email.trim().toLowerCase()) {
              const best = pickBestEmail(c.name || ex.name || '', [ex.email, c.email])
              if (best && best.trim().toLowerCase() !== ex.email.trim().toLowerCase()) {
                updates.email = best
              }
            }
          }
          if (c.phone && !ex.direct_phone && /[+\d]/.test(c.phone)) {
            updates.direct_phone = c.phone
          }
          if (c.mobile && !ex.mobile && /[+\d]/.test(c.mobile)) {
            updates.mobile = c.mobile
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from('partner_contacts').update(updates).eq('id', ex.id)
            updated++
          }
        } else if (!ex) {
          const validEmail = c.email && /\S+@\S+\.\S+/.test(c.email) && !/wcaworld/i.test(c.email) ? c.email : null
          const validPhone = c.phone && /[+\d]/.test(c.phone) && !/Members/i.test(c.phone) ? c.phone : null
          const validMobile = c.mobile && /[+\d]/.test(c.mobile) && !/Members/i.test(c.mobile) ? c.mobile : null

          await supabase.from('partner_contacts').insert({
            partner_id: partnerId,
            name: c.name || title,
            title,
            email: validEmail,
            direct_phone: validPhone,
            mobile: validMobile,
          })
          inserted++
        }
      }

      console.log(`save-wca-contacts: ${partner.company_name} (${wcaId}) — updated=${updated}, inserted=${inserted}`)
      results.push({ wcaId, success: true, companyName: partner.company_name, updated, inserted })
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('save-wca-contacts error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
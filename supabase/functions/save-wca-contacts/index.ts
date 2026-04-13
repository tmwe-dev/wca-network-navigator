import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

// Valid enum values for matching
const SERVICE_MAP: Record<string, string> = {
  'air freight': 'air_freight',
  'air cargo': 'air_freight',
  'ocean fcl': 'ocean_fcl',
  'sea freight fcl': 'ocean_fcl',
  'ocean lcl': 'ocean_lcl',
  'sea freight lcl': 'ocean_lcl',
  'road freight': 'road_freight',
  'road transport': 'road_freight',
  'trucking': 'road_freight',
  'rail freight': 'rail_freight',
  'rail': 'rail_freight',
  'project cargo': 'project_cargo',
  'project': 'project_cargo',
  'dangerous goods': 'dangerous_goods',
  'hazmat': 'dangerous_goods',
  'perishables': 'perishables',
  'reefer': 'perishables',
  'pharma': 'pharma',
  'pharmaceutical': 'pharma',
  'ecommerce': 'ecommerce',
  'e-commerce': 'ecommerce',
  'relocations': 'relocations',
  'moving': 'relocations',
  'customs broker': 'customs_broker',
  'customs brokerage': 'customs_broker',
  'customs': 'customs_broker',
  'warehousing': 'warehousing',
  'warehouse': 'warehousing',
  'storage': 'warehousing',
  'nvocc': 'nvocc',
}

const CERT_MAP: Record<string, string> = {
  'iata': 'IATA',
  'basc': 'BASC',
  'iso': 'ISO',
  'c-tpat': 'C-TPAT',
  'ctpat': 'C-TPAT',
  'aeo': 'AEO',
}

function matchService(raw: string): string | null {
  const key = raw.trim().toLowerCase()
  return SERVICE_MAP[key] || null
}

function matchCert(raw: string): string | null {
  const key = raw.trim().toLowerCase()
  for (const [pattern, val] of Object.entries(CERT_MAP)) {
    if (key.includes(pattern)) return val
  }
  return null
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  // Try common formats: "01/01/2025", "January 2025", "2025-01-01"
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  // Try DD/MM/YYYY
  const parts = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (parts) {
    const d2 = new Date(`${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`)
    if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0]
  }
  return null
}

/** Pick best email matching person's name */
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

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.json()
    const items: Array<{ wcaId: number; contacts: Array<Record<string, unknown>>; profile?: any; profileHtml?: string }> = body.batch || [body]
    const results: Array<Record<string, unknown>> = []

    for (const item of items) {
      const { wcaId, contacts, profile, profileHtml } = item
      if (!wcaId) {
        results.push({ wcaId, success: false, error: 'wcaId required' })
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

      // ══════════════════════════════════════════════════
      // PART 1: Save PROFILE data to partners table
      // ══════════════════════════════════════════════════
      if (profile) {
        const partnerUpdate: Record<string, any> = {}
        if (profile.address) partnerUpdate.address = profile.address
        if (profile.phone) partnerUpdate.phone = profile.phone
        if (profile.fax) partnerUpdate.fax = profile.fax
        if (profile.mobile) partnerUpdate.mobile = profile.mobile
        if (profile.emergencyPhone) partnerUpdate.emergency_phone = profile.emergencyPhone
        if (profile.email) partnerUpdate.email = profile.email
        if (profile.website) partnerUpdate.website = profile.website
        if (profile.description) partnerUpdate.profile_description = profile.description

        const memberSince = parseDate(profile.memberSince)
        if (memberSince) partnerUpdate.member_since = memberSince

        const memberExpires = parseDate(profile.membershipExpires)
        if (memberExpires) partnerUpdate.membership_expires = memberExpires

        if (profile.officeType) {
          const ot = profile.officeType.toLowerCase()
          if (ot.includes('head') || ot.includes('main') || ot.includes('principal')) {
            partnerUpdate.office_type = 'head_office'
          } else if (ot.includes('branch')) {
            partnerUpdate.office_type = 'branch'
          }
        }

        if (profile.branchCities && profile.branchCities.length > 0) {
          partnerUpdate.has_branches = true
          partnerUpdate.branch_cities = profile.branchCities
        }

        if (Object.keys(partnerUpdate).length > 0) {
          partnerUpdate.updated_at = new Date().toISOString()
          await supabase.from('partners').update(partnerUpdate).eq('id', partnerId)
        }

        // ── Networks ──
        if (profile.networks && profile.networks.length > 0) {
          const { data: existingNets } = await supabase
            .from('partner_networks')
            .select('network_name')
            .eq('partner_id', partnerId)
          const existingNetNames = new Set((existingNets || []).map((n: Record<string, unknown>) => n.network_name.toLowerCase()))

          for (const net of profile.networks) {
            if (!net.name) continue
            if (existingNetNames.has(net.name.toLowerCase())) continue
            const netInsert: Record<string, unknown> = { partner_id: partnerId, network_name: net.name }
            if (net.expires) {
              const exp = parseDate(net.expires)
              if (exp) netInsert.expires = exp
            }
            await supabase.from('partner_networks').insert(netInsert)
          }
        }

        // ── Services ──
        if (profile.services && profile.services.length > 0) {
          const { data: existingSvc } = await supabase
            .from('partner_services')
            .select('service_category')
            .eq('partner_id', partnerId)
          const existingSvcSet = new Set((existingSvc || []).map((s: Record<string, unknown>) => s.service_category))

          for (const svc of profile.services) {
            const mapped = matchService(svc)
            if (mapped && !existingSvcSet.has(mapped)) {
              await supabase.from('partner_services').insert({
                partner_id: partnerId,
                service_category: mapped,
              })
              existingSvcSet.add(mapped)
            }
          }
        }

        // ── Certifications ──
        if (profile.certifications && profile.certifications.length > 0) {
          const { data: existingCert } = await supabase
            .from('partner_certifications')
            .select('certification')
            .eq('partner_id', partnerId)
          const existingCertSet = new Set((existingCert || []).map((c: Record<string, unknown>) => c.certification))

          for (const cert of profile.certifications) {
            const mapped = matchCert(cert)
            if (mapped && !existingCertSet.has(mapped)) {
              await supabase.from('partner_certifications').insert({
                partner_id: partnerId,
                certification: mapped,
              })
              existingCertSet.add(mapped)
            }
          }
        }
      }

      // ── Save raw HTML independently (even if structured profile is empty) ──
      if (profileHtml) {
        await supabase.from('partners').update({
          raw_profile_html: profileHtml,
          updated_at: new Date().toISOString()
        }).eq('id', partnerId)
      }

      // ══════════════════════════════════════════════════
      // PART 2: Save CONTACTS (existing logic)
      // ══════════════════════════════════════════════════
      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        console.log(`save-wca-contacts: ${partner.company_name} (${wcaId}) — profile saved, no contacts`)
        results.push({ wcaId, success: true, companyName: partner.company_name, updated: 0, inserted: 0, profileSaved: true })
        continue
      }

      // Deduplicate incoming contacts by email
      const dedupByEmail: Array<Record<string, unknown>> = []
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

      // Deduplicate by NAME
      const deduped: Array<Record<string, unknown>> = []
      const seenNames = new Map<string, number>()
      for (const c of dedupByEmail) {
        const nameKey = (c.name || c.title || '').trim().toLowerCase()
        if (!nameKey) { deduped.push(c); continue }
        if (seenNames.has(nameKey)) {
          const idx = seenNames.get(nameKey)!
          const ex = deduped[idx]
          if (c.title && c.title !== ex.title && !ex.title?.includes(c.title)) ex.title = `${ex.title} / ${c.title}`
          if (c.email) ex._emails.push(c.email)
          if (c.phone && !ex.phone) ex.phone = c.phone
          if (c.mobile && !ex.mobile) ex.mobile = c.mobile
        } else {
          seenNames.set(nameKey, deduped.length)
          deduped.push({ ...c, _emails: [...(c._emails || []), ...(c.email && !c._emails?.includes(c.email) ? [c.email] : [])] })
        }
      }

      // Resolve best email
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

        let ex = nameKey ? existingByName.get(nameKey) : undefined
        if (!ex && emailKey) ex = existingByEmail.get(emailKey)
        if (!ex) ex = existingByTitle.get(title)

        if (ex && !usedIds.has(ex.id)) {
          usedIds.add(ex.id)
          const updates: Record<string, string> = {}
          if (c.name && c.name !== ex.name && (!ex.name || ex.name === ex.title)) updates.name = c.name
          if (c.title && c.title !== ex.title && !ex.title?.includes(c.title)) {
            updates.title = ex.title ? `${ex.title} / ${c.title}` : c.title
          }
          if (c.email && /\S+@\S+\.\S+/.test(c.email)) {
            if (!ex.email) {
              updates.email = c.email
            } else if (c.email.trim().toLowerCase() !== ex.email.trim().toLowerCase()) {
              const best = pickBestEmail(c.name || ex.name || '', [ex.email, c.email])
              if (best && best.trim().toLowerCase() !== ex.email.trim().toLowerCase()) updates.email = best
            }
          }
          if (c.phone && !ex.direct_phone && /[+\d]/.test(c.phone)) updates.direct_phone = c.phone
          if (c.mobile && !ex.mobile && /[+\d]/.test(c.mobile)) updates.mobile = c.mobile
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

      console.log(`save-wca-contacts: ${partner.company_name} (${wcaId}) — contacts: updated=${updated}, inserted=${inserted}, profile saved`)
      results.push({ wcaId, success: true, companyName: partner.company_name, updated, inserted, profileSaved: true })
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...dynCors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('save-wca-contacts error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...dynCors, 'Content-Type': 'application/json' } }
    )
  }
})

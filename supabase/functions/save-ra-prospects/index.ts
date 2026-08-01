import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireExtensionAuth, isExtensionAuthError } from "../_shared/extensionAuth.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const auth = await requireExtensionAuth(req, dynCors);
  if (isExtensionAuthError(auth)) return auth;

  try {
    const { prospects } = await req.json()
    if (!Array.isArray(prospects) || prospects.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'Nessun prospect da salvare' }), {
        status: 400,
        headers: { ...dynCors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let saved = 0
    let errors = 0

    for (const p of prospects) {
      try {
        // Upsert prospect by partita_iva or company_name
        const { data: existing } = p.partita_iva
          ? await supabase.from('prospects').select('id').eq('partita_iva', p.partita_iva).maybeSingle()
          : await supabase.from('prospects').select('id').eq('company_name', p.company_name).eq('city', p.city || '').maybeSingle()

        let prospectId: string

        if (existing) {
          const { error } = await supabase.from('prospects').update({
            ...p,
            contacts: undefined,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)
          if (error) throw error
          prospectId = existing.id
        } else {
          const { data: inserted, error } = await supabase.from('prospects').insert({
            company_name: p.company_name,
            partita_iva: p.partita_iva,
            codice_fiscale: p.codice_fiscale,
            city: p.city,
            province: p.province,
            region: p.region,
            address: p.address,
            cap: p.cap,
            phone: p.phone,
            email: p.email,
            pec: p.pec,
            website: p.website,
            fatturato: p.fatturato,
            utile: p.utile,
            dipendenti: p.dipendenti,
            anno_bilancio: p.anno_bilancio,
            codice_ateco: p.codice_ateco,
            descrizione_ateco: p.descrizione_ateco,
            forma_giuridica: p.forma_giuridica,
            data_costituzione: p.data_costituzione,
            rating_affidabilita: p.rating_affidabilita,
            credit_score: p.credit_score,
            raw_profile_html: p.raw_profile_html,
            enrichment_data: p.enrichment_data,
            source: p.source || 'reportaziende',
          }).select('id').single()
          if (error) throw error
          prospectId = inserted.id
        }

        // Save contacts if present
        if (Array.isArray(p.contacts)) {
          for (const c of p.contacts) {
            await supabase.from('prospect_contacts').upsert({
              prospect_id: prospectId,
              name: c.name,
              role: c.role,
              codice_fiscale: c.codice_fiscale,
              email: c.email,
              phone: c.phone,
              linkedin_url: c.linkedin_url,
            }, { onConflict: 'prospect_id,name' }).single()
          }
        }

        saved++
      } catch (err) {
        console.error('Error saving prospect:', p.company_name, err)
        errors++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      saved,
      errors,
      message: `Salvati ${saved} prospect${errors > 0 ? `, ${errors} errori` : ''}`,
    }), {
      headers: { ...dynCors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('save-ra-prospects error:', error)
    return new Response(JSON.stringify({
      success: false,
      message: 'Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto'),
    }), {
      status: 500,
      headers: { ...dynCors, 'Content-Type': 'application/json' },
    })
  }
})

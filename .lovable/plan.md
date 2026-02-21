
# Deep Search Potenziata + Dettaglio Contatti Interattivo

## Problema attuale

1. **Deep Search limitata**: cerca solo LinkedIn/Facebook/Instagram dei contatti ma non genera link WhatsApp diretti, non verifica i numeri e non mostra i profili trovati nella scheda contatto in modo interattivo
2. **Nessun link WhatsApp**: i numeri mobile sono mostrati come testo, senza link `wa.me/` per contattare direttamente
3. **EnrichmentCard quasi vuota**: mostra solo la data di arricchimento, non il contenuto ricco (profilo contatti, profilo azienda, awards, specialties)
4. **Social links nei contatti poco visibili**: mostrati come badge testuali generici, non come icone cliccabili intuitive

---

## Cosa faremo

### 1. Link WhatsApp diretti per ogni contatto con numero mobile

Nella sezione contatti (sia PartnerDetailFull che PartnerDetailCompact), accanto a ogni numero mobile, aggiungere un'icona WhatsApp cliccabile che apre `https://wa.me/{numero_pulito}`.

Il numero viene normalizzato rimuovendo spazi, trattini e il "+" iniziale.

### 2. Deep Search potenziata: WhatsApp link automatici

Nella edge function `deep-search-partner`, dopo aver trovato i social, per ogni contatto con numero mobile:
- Generare automaticamente un link WhatsApp (`wa.me/{numero}`) e salvarlo come social link con platform `whatsapp`
- Non serve verificare se il numero sia effettivamente WhatsApp (non esiste un'API pubblica per farlo), ma il link funzionera comunque se il numero e registrato

### 3. Enrichment Card completa con dati ricchi

Riprogettare `EnrichmentCard` per mostrare tutti i dati raccolti dalla Deep Search:
- **Profilo contatti**: background professionale, lingue, interessi (da `enrichment_data.contact_profiles`)
- **Profilo aziendale**: awards, specialties, news recenti, anno fondazione (da `enrichment_data.company_profile`)
- **Data deep search** (da `enrichment_data.deep_search_at`)

### 4. Social links visivi per contatti

Migliorare `SocialLinks` per mostrare icone SVG colorate (LinkedIn blu, Facebook blu, WhatsApp verde, Instagram gradiente) invece di emoji generiche, con tooltip al passaggio del mouse.

### 5. Deep Search: aggiungere ricerca profilo LinkedIn dettagliato

Nella edge function, se viene trovato un LinkedIn personale, fare una ricerca web aggiuntiva tipo `site:linkedin.com/in/{slug}` per estrarre titolo e seniority dal titolo della pagina (senza necessita di login LinkedIn). Salvare il livello di seniority nel profilo contatto (`enrichment_data.contact_profiles[id].seniority`).

---

## Modifiche ai file

### Edge Function: `supabase/functions/deep-search-partner/index.ts`

- Dopo il loop contatti social, aggiungere step "WhatsApp auto-link": per ogni contatto con `mobile`, creare un record `partner_social_links` con platform `whatsapp` e url `https://wa.me/{numero_normalizzato}`
- Dopo aver trovato un LinkedIn personale, estrarre seniority dal titolo della pagina di ricerca (gia disponibile nei risultati Firecrawl, senza chiamata AI aggiuntiva)
- Salvare seniority in `contact_profiles[id].seniority`

### UI: `src/components/partners/PartnerDetailFull.tsx`

- Nella sezione contatti, accanto a ogni numero mobile, aggiungere icona WhatsApp cliccabile (`wa.me/`)
- Sotto ogni contatto con dati enrichment, mostrare badges con: seniority, lingue, background (1 riga)
- Rendere i social links del contatto piu prominenti con icone SVG colorate

### UI: `src/components/partners/PartnerDetailCompact.tsx`

- Stesse modifiche WhatsApp link per i contatti
- Aggiungere icone social cliccabili per contatto

### UI: `src/components/partners/SocialLinks.tsx`

- Sostituire emoji con icone SVG (LinkedIn, Facebook, Instagram, WhatsApp)
- Aggiungere colori specifici per piattaforma
- Per WhatsApp: icona verde con link diretto

### UI: `src/components/partners/EnrichmentCard.tsx`

- Mostrare profilo aziendale arricchito: awards, specialties, news recenti, anno fondazione, stima dipendenti
- Mostrare profili contatto arricchiti: per ogni contatto con dati, mostrare background, seniority, lingue, interessi
- Layout organizzato con sezioni collapsibili

---

## Dettagli tecnici

### Normalizzazione numero per WhatsApp
```typescript
function toWhatsAppUrl(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
  return `https://wa.me/${cleaned}`;
}
```

### WhatsApp auto-link nella Deep Search
```typescript
// After social search loop, for each contact with mobile
for (const contact of contacts) {
  if (contact.mobile && !existingSet.has(`${contact.id}_whatsapp`)) {
    const cleaned = contact.mobile.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
    await supabase.from('partner_social_links').insert({
      partner_id: partnerId,
      contact_id: contact.id,
      platform: 'whatsapp',
      url: `https://wa.me/${cleaned}`
    });
    socialLinksFound++;
  }
}
```

### Seniority extraction (dal titolo pagina LinkedIn)
```typescript
// Already have search result title like "John Doe - CEO at Company | LinkedIn"
const titleParts = result.title?.split(' - ') || [];
if (titleParts.length > 1) {
  const role = titleParts[1].split(' | ')[0]?.trim();
  // Classify seniority from title keywords
  const seniorKeywords = ['CEO', 'Director', 'VP', 'President', 'Owner', 'Founder', 'Managing', 'General Manager', 'Head'];
  const midKeywords = ['Manager', 'Supervisor', 'Lead', 'Senior', 'Coordinator'];
  let seniority = 'junior';
  if (seniorKeywords.some(k => role?.includes(k))) seniority = 'senior';
  else if (midKeywords.some(k => role?.includes(k))) seniority = 'mid';
  contactProfiles[contact.id].seniority = seniority;
  contactProfiles[contact.id].linkedin_title = role;
}
```

### File da modificare

| File | Modifica |
|------|---------|
| `supabase/functions/deep-search-partner/index.ts` | WhatsApp auto-link + seniority extraction |
| `src/components/partners/PartnerDetailFull.tsx` | WhatsApp icon nei contatti + enrichment badges |
| `src/components/partners/PartnerDetailCompact.tsx` | WhatsApp icon nei contatti |
| `src/components/partners/SocialLinks.tsx` | Icone SVG colorate per piattaforma |
| `src/components/partners/EnrichmentCard.tsx` | Mostrare dati ricchi (profili, awards, company) |

Nessuna modifica al database necessaria -- tutti i dati vengono salvati nelle tabelle esistenti (`partner_social_links`, `partners.enrichment_data`).

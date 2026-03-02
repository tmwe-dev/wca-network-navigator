

## Diagnosi: perche la Deep Search non trova i loghi

### Il bug (linee 553-618 di `deep-search-partner/index.ts`)

La sezione "LOGO + WEBSITE QUALITY" fa scraping del sito web con:
```typescript
formats: ['links', 'markdown']   // ← SBAGLIATO
```

Poi cerca il logo SOLO qui:
```typescript
const logoUrl = metadata.ogImage || metadata['og:image'] || null
```

**Problema 1**: Non usa il formato `'branding'` di Firecrawl, che e l'unico che estrae il logo vero del sito. `ogImage` e l'immagine di anteprima social (spesso un banner generico o assente del tutto), NON il logo aziendale.

**Problema 2**: Il commento a riga 577 dice esplicitamente `"Only save real logos, no favicon fallbacks"` — ma paradossalmente sta cercando gli OG image (che non sono loghi) e rifiuta i favicon (che almeno sono un riferimento visivo).

**Problema 3**: Non c'e nessun tentativo di estrarre il logo dalla pagina WCA stessa (che lo ha quasi sempre). Il `raw_profile_html` salvato durante il download contiene spesso il logo dell'azienda, ma la Deep Search lo ignora completamente.

### Soluzione

Modificare la sezione logo della edge function `deep-search-partner/index.ts` con una strategia a 3 livelli:

1. **Livello 1 — Firecrawl Branding**: Usare `formats: ['branding', 'markdown']` invece di `['links', 'markdown']`. Il campo `branding.logo` o `branding.images.logo` restituisce il logo reale estratto dal sito.

2. **Livello 2 — Fallback OG Image**: Se branding non trova il logo, usare `ogImage` come prima (ma come fallback, non come unica fonte).

3. **Livello 3 — Google Favicon**: Se nessuno dei precedenti funziona, usare `https://www.google.com/s2/favicons?domain=DOMINIO&sz=128` come ultimo fallback visivo.

### File da modificare

| File | Modifica |
|------|----------|
| `supabase/functions/deep-search-partner/index.ts` | Righe 553-618: cambiare formato scrape a `['branding', 'markdown']`, estrarre logo da `branding.logo` / `branding.images.logo`, aggiungere fallback favicon Google |

### Codice della sezione logo riscritta

```typescript
// ═══ LOGO + WEBSITE QUALITY FROM WEBSITE ═══
let websiteQualityScore = 0
if (partner.website) {
  try {
    const websiteUrl = partner.website.startsWith('http') ? partner.website : `https://${partner.website}`
    console.log(`Scraping logo + website quality: ${websiteUrl}`)
    const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: websiteUrl, formats: ['branding', 'markdown'] }),
    })
    if (scrapeResp.ok) {
      const scrapeData = await scrapeResp.json()
      const branding = scrapeData?.data?.branding || scrapeData?.branding || {}
      const metadata = scrapeData?.data?.metadata || scrapeData?.metadata || {}

      // Priority 1: branding logo
      let logoUrl = branding?.logo || branding?.images?.logo || null

      // Priority 2: OG image fallback
      if (!logoUrl) {
        logoUrl = metadata.ogImage || metadata['og:image'] || null
      }

      // Validate logo URL
      if (logoUrl) {
        try {
          const headResp = await fetch(logoUrl, { method: 'HEAD' })
          if (!headResp.ok) logoUrl = null
        } catch { logoUrl = null }
      }

      // Priority 3: Google favicon as last resort
      if (!logoUrl) {
        try {
          const domain = new URL(websiteUrl).hostname
          logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
        } catch {}
      }

      if (logoUrl) {
        const { error } = await supabase.from('partners').update({ logo_url: logoUrl }).eq('id', partnerId)
        if (!error) logoFound = true
      }

      // Website quality eval rimane invariato...
    }
  } catch (e) {
    console.error('Logo/website quality error:', e)
  }
}
```

Nessun'altra modifica necessaria — il resto della funzione (social links, rating, contacts) non cambia.


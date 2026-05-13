# Badge Arricchimento, Deep Search e Logo sulle card partner

## Stato attuale (verificato sul DB)

- **1.218 partner** hanno un `logo_url` salvato
- **1.238 partner** hanno `enriched_at` valorizzato (= arricchiti)
- **0 partner** hanno `deep_search_at` (Deep Search vero non ancora usato in produzione)
- Il logo è già nel campo giusto, **non** è "sepolto" dentro `enrichment_data`

## Cosa mostra oggi la card (`PartnerCard.tsx`)

- ✅ Logo (se `logo_url` valido) → fallback favicon → fallback bandiera
- ✅ Badge "D" Deep Search (ma sblocca solo su `deep_search_at`, quindi oggi mai)
- ✅ Badge Sherlock (se livello investigativo presente)
- ❌ **Manca il badge "Arricchito"** — i 1.238 partner arricchiti non sono distinguibili a colpo d'occhio
- ❌ Badge Deep Search e logo non sono coerenti tra `PartnerCard`, `PartnerListItem` e `PartnerDetailHeader`

## Cosa farò

### 1. Nuovo badge `EnrichmentBadge` riutilizzabile
File nuovo: `src/v2/ui/atoms/EnrichmentBadge.tsx`

Componente unico che, dato un partner, decide quale badge mostrare in base alla "profondità" dell'indagine:

| Livello | Trigger DB | Badge | Colore |
|---|---|---|---|
| Sherlock | `sherlock_level` esistente | "🔍 Sherlock L1/L2/L3" | viola |
| Deep Search | `enrichment_data.deep_search_at` | "DS" + tooltip data | primary |
| Arricchito | `enriched_at IS NOT NULL` | "✨ Arricchito" + tooltip data | emerald |
| (nessuno) | — | nessun badge | — |

Mostra il badge **più alto** disponibile, più gli altri come piccoli pallini se compresenti.

### 2. Logo coerente ovunque
Sostituisco la lettura grezza `partner.logo_url` con l'helper esistente `getEffectiveLogoUrl(partner)` (già in `src/lib/partnerUtils.ts`, fa fallback su `enrichment_data.logo_url`). Così se in futuro l'enrichment scarica un logo, viene mostrato anche se non viene copiato sul campo principale.

### 3. Card aggiornate (3 punti)
- `src/components/partners/PartnerCard.tsx` — card grid principale
- `src/components/partners/PartnerListItem.tsx` — vista lista
- `src/components/partners/PartnerDetailHeader.tsx` — header dettaglio

In ogni file:
- Sostituire badge "D" inline con `<EnrichmentBadge partner={partner} />`
- Sostituire `partner.logo_url` con `getEffectiveLogoUrl(partner)`

### 4. Nessuna modifica a logica/DB
Solo lettura di campi già esistenti (`enriched_at`, `enrichment_data.deep_search_at`, `logo_url`). Nessuna migrazione, nessuna chiamata edge, nessun costo AI.

## Costi
**Zero.** È solo UI che legge dati già presenti. Nessuna chiamata AI, nessuna scrittura DB.

## File toccati
- ➕ `src/v2/ui/atoms/EnrichmentBadge.tsx` (nuovo, ~60 righe)
- ✏️ `src/components/partners/PartnerCard.tsx`
- ✏️ `src/components/partners/PartnerListItem.tsx`
- ✏️ `src/components/partners/PartnerDetailHeader.tsx`

## Cosa NON è incluso
- Il fix del bug "città Adelaide" sui 3.842 record → resta nel cassetto in attesa della tua approvazione separata
- Modifiche al pipeline di enrichment a monte
- Nuovi download logo (mostro solo quelli già presenti in DB)
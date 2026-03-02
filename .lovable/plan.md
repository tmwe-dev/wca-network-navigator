

## ✅ Fix anti-bot WCA — Implementato

### Modifiche applicate

1. **`public/chrome-extension/background.js`** — `extractContactsForId` ora include `htmlLength` nella risposta per permettere il rilevamento di pagine template identiche.

2. **`src/hooks/useDownloadProcessor.ts`** — Rate-limit detection:
   - Tracker delle lunghezze HTML delle risposte "not found"
   - Se 3+ consecutivi hanno html identico (>1000 chars) → trattati come RATE-LIMIT, non "genuinely not found"
   - Backoff automatico a 30s quando rilevato
   - NON vengono salvati in `partners_no_contacts`
   - Pausa automatica dopo 6+ rate-limited consecutivi
   - Al retry pass, profili rate-limited non vengono marcati come permanenti

3. **`src/lib/wcaCheckpoint.ts`** — Delay default da 15s → 20s. Nuove funzioni `setGreenZoneDelay()` / `getGreenZoneDelay()` per backoff dinamico a 30s.

4. **Database** — Tutti i record in `partners_no_contacts` con `country_code = 'ZA'` marcati `resolved = true` per permettere il retry.

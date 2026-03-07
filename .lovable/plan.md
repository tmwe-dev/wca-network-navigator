

## Auto-detect lingua destinatario per generazione email

### Problema attuale
La lingua è determinata dal campo `effectiveLanguage` (riga 404) che usa il parametro `language` passato dal client o il setting `ai_language`. Non c'è nessuna logica automatica basata sul paese del destinatario.

### Soluzione
Aggiungere nel `generate-email/index.ts` una funzione di rilevamento automatico della lingua basata sul `country_code` del destinatario. La logica:

1. **Mappa paese → lingua**: IT→italiano, ES/AR/MX/CO/CL/PE/VE/EC→spagnolo, FR/BE(fr)/CI/SN→francese, DE/AT/CH→tedesco, PT/BR→portoghese, tutti gli altri→inglese
2. **Override della regola 1 nel system prompt**: invece di usare `effectiveLanguage` statico, il sistema sceglie automaticamente la lingua del destinatario dal suo `country_code`
3. **Subject incluso**: l'oggetto viene scritto nella stessa lingua del corpo

### Modifiche

**File: `supabase/functions/generate-email/index.ts`**
- Aggiungere funzione `detectLanguage(countryCode: string): string` con la mappa paese→lingua
- Calcolare `detectedLanguage = detectLanguage(partner.country_code)` dopo aver costruito il partner context
- Sostituire riga 404: `effectiveLanguage` usa `detectedLanguage` come default invece di `"inglese"`
- Aggiornare la regola 1 del system prompt per essere esplicita: `"Scrivi INTERAMENTE in {lingua} — oggetto, saluto, corpo e chiusura"`

Nessuna modifica al frontend necessaria — la lingua viene determinata automaticamente server-side.


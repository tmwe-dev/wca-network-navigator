

## Fix CORS dinamico — 3 file, zero logica IMAP toccata

### Diagnosi
Il dominio della preview Lovable (`*.lovableproject.com`) non è nella whitelist CORS. Il browser blocca le risposte delle edge function → "Errore scaricamento posta".

### Modifiche

**File 1 — `supabase/functions/_shared/cors.ts`**
- Aggiungere `"https://c57c2f66-1827-4bc4-9643-9b6951bf4e62.lovableproject.com"` come terza entry nell'array `ALLOWED_ORIGINS` (prima dei localhost)
- Da 4 a 5 entry, nient'altro cambia

**File 2 — `supabase/functions/_shared/handleEdgeError.ts`**
- Aggiungere parametro opzionale `customHeaders?: Record<string, string>` a `edgeError()`
- Nella riga headers: `...(customHeaders || corsHeaders)` — backward-compatible, chi non passa il parametro usa i default

**File 3 — `supabase/functions/check-inbox/index.ts`**
- Importare `getCorsHeaders` da `"../_shared/cors.ts"` (riga 8)
- Subito dentro `Deno.serve`, prima del preflight (riga 25-26): estrarre origin e creare `dynCors`
- Sostituire tutte le 3 occorrenze di `corsHeaders` con `dynCors`:
  - Riga 26: preflight OPTIONS
  - Riga 513: response di successo
  - Riga 517: `edgeError("INTERNAL_ERROR", ..., undefined, dynCors)`
- Riga 31: `edgeError("AUTH_REQUIRED", "Unauthorized", undefined, dynCors)`

### Dettagli tecnici
- 5 occorrenze totali da aggiornare in check-inbox (preflight, auth error, success response, catch error)
- `edgeError` resta backward-compatible: il 4° parametro è opzionale con default a `corsHeaders`
- Zero `any` aggiunti
- Deploy automatico post-salvataggio


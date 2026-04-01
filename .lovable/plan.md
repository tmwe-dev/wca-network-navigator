

# Fix: Indicatore di Stato Connessioni — Smette di Mentire

## Problema

La barra in alto dice "Tutto attivo" (4/4) anche quando **niente funziona realmente**. Cause:

1. **LinkedIn**: se nel DB c'è `linkedin_connected = "true"` (salvato in una sessione precedente) O se trova credenziali nell'edge function (`get-linkedin-credentials`), segna "connesso" — anche se l'estensione non c'è e la sessione è scaduta
2. **WhatsApp**: se nel DB c'è `whatsapp_sender` o `whatsapp_connected = "true"`, segna "connesso" — anche senza estensione e senza sessione reale
3. **AI**: segna **sempre** `true` senza alcuna verifica
4. **Fallback catch**: i `catch {}` vuoti nel `activateAll` fanno sì che errori vengano ignorati e lo stato resti "ok"

In pratica: lo stato viene letto dal DB (vecchio) e non verificato in tempo reale. L'indicatore mente.

## Soluzione

### Regole nuove per ogni canale

| Canale | Verde SOLO se... |
|--------|-------------------|
| LinkedIn | `li.isAvailable === true` (estensione risponde al ping) **E** `verifySession()` restituisce `success: true` |
| WhatsApp | `wa.isAvailable === true` (estensione risponde) **E** `verifySession()` restituisce `success: true` — OPPURE — `whatsapp_sender` configurato (API mode) |
| Partner Connect | `fsExt.isAvailable === true` (risponde al ping) |
| AI | Verifica rapida: chiama `supabase.functions.invoke("ai-gateway-healthcheck")` o, se non esiste, segna `true` come fallback (unico caso ammesso) |

### Modifiche al file `ConnectionStatusBar.tsx`

1. **Rimuovere la lettura dal DB come fonte primaria**: non usare più `settings["linkedin_connected"]` o `settings["whatsapp_connected"]` per impostare lo stato iniziale. Lo stato parte da `false` e diventa `true` solo dopo verifica reale.

2. **`activateAll()` — verifica reale obbligatoria**:
   - LinkedIn: se `li.isAvailable` → chiama `verifySession()`. Se `success === false` → `liOk = false`. Se estensione assente → `liOk = false` (non basta avere credenziali nel DB)
   - WhatsApp: se `wa.isAvailable` → chiama `verifySession()`. Se estensione assente → controlla solo `whatsapp_sender` per API mode
   - Rimuovere tutti i `catch { liOk = true }` e `catch { waOk = true }` — se la verifica fallisce, lo stato è `false`

3. **Aggiornare il DB solo con lo stato reale**: continua a salvare `linkedin_connected` e `whatsapp_connected`, ma ora riflettono la verifica reale

4. **Toast onesto**: se non tutto è connesso, mostra quali canali mancano specificamente (es. "LinkedIn: estensione non rilevata", "WhatsApp: sessione scaduta")

5. **Effetto mount**: rimuovere `setStatus` dal DB al primo render — partire tutto da `false`, poi `activateAll` verifica

### File modificato

| File | Cosa cambia |
|------|-------------|
| `src/components/layout/ConnectionStatusBar.tsx` | Logica di verifica reale, rimozione falsi positivi dal DB, toast onesti |

### Risultato

- Se l'estensione LinkedIn non è installata → pallino rosso, non verde
- Se LinkedIn ha credenziali ma la sessione è scaduta → pallino rosso
- Se WhatsApp non ha estensione e non ha sender API → pallino rosso
- Il badge dice "2/4 attivi" o "1/4 attivi" — la verità




# Fix `AIAutomationToggle` — pull GitHub rotto, da allineare allo schema reale

## Problema

Il nuovo componente `src/components/header/AIAutomationToggle.tsx` (montato in `LayoutHeader.tsx`) è stato scritto contro uno schema `app_settings` obsoleto. Lo schema reale dal 2026-04-10 richiede:
- `user_id NOT NULL` (RLS: `auth.uid() = user_id`)
- Unique constraint composito `(user_id, key)`

Bug nel file:
1. SELECT senza `.eq('user_id', userId)` → legge righe di altri utenti o nulla per via RLS
2. UPSERT senza `user_id` nel payload → viola NOT NULL e RLS
3. `onConflict: 'key'` invece di `'user_id,key'` → vincolo non corrispondente
4. Duplicato funzionale di `GlobalAIAutomationPause` (stessa chiave `ai_automations_paused`, stesso scopo)

L'enorme lista "Check ..." nel build error sono solo i file edge function elencati per controllo statico — non sono errori reali, solo l'unico file rotto è `AIAutomationToggle.tsx`.

## Cosa correggo

**File:** `src/components/header/AIAutomationToggle.tsx`

Tre fix chirurgici, mantengo design e UX identici (badge compatto verde/rosso in header):

1. SELECT con `.eq('user_id', data.user.id)` per leggere solo la riga dell'utente corrente.
2. UPSERT con `user_id: userId` nel payload e `onConflict: 'user_id,key'`.
3. Non tocco il design né LayoutHeader.

Risultato: il toggle in header funziona correttamente, condivide lo stato con `GlobalAIAutomationPause` (entrambi leggono/scrivono la stessa chiave per lo stesso user_id, quindi sono sincronizzati automaticamente).

## Cosa NON tocco

- `GlobalAIAutomationPause.tsx` (già corretto)
- `LayoutHeader.tsx` (montaggio del toggle è ok)
- Tabella `app_settings` (schema già corretto, no migration)
- Edge functions (la lista nel build error è rumore, non errori veri)
- Nessuna modifica al conflitto Partner Connect / WhatsApp — quello resta separato (ricordo che hai già rifiutato due volte quel piano, qui non lo ritocco)

## Verifica

1. Header mostra `AI on` (verde) o `AI off` (rosso) coerente con lo stato reale del DB per il tuo utente.
2. Click sul toggle aggiorna DB senza errori RLS / NOT NULL / conflict.
3. Aprire `/v2/ai-control` mostra lo stesso stato (i due componenti sono sincronizzati sulla stessa chiave).
4. Build error si svuota.

## File modificati

- `src/components/header/AIAutomationToggle.tsx` (3 piccoli fix in select/upsert)

Nessun DB, nessuna edge function, nessuna migration.


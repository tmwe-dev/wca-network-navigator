

## Audit & Piano: 3 Fix Sicurezza Isolamento Dati

### Scoperta importante durante l'audit
Il prompt assume che `userId` sia disponibile nella closure di `createWriteHandlers(supabase)`. **Non lo è**: il factory viene istanziato a livello modulo in `ai-assistant/index.ts` riga 44 (`const writeH = createWriteHandlers(supabase)`), prima che `userId` venga estratto dal JWT della request. Quindi `userId` deve essere passato **per ogni chiamata** dell'handler, non al factory. Gli stessi bug esistono **duplicati** in altri 2 file: `agent-execute/toolHandlers.ts` e `_shared/platformTools.ts`. Vanno fixati anche lì per coerenza, altrimenti l'AI invocata dagli agenti autonomi continuerebbe a creare record orfani.

---

### FIX #5 — `loadUserProfile` userId obbligatorio
**File**: `supabase/functions/ai-assistant/contextLoader.ts` riga 66-68
- Cambia firma in `userId: string` (non opzionale) + early return se vuoto + filtro `.eq("user_id", userId)` sempre applicato.
- I 2 call site in `index.ts` (righe 374, 384) già passano `userId` → zero impatto runtime.

### FIX #6 — Activities & Reminders con `user_id` esplicito
**File `_shared/toolHandlersWrite.ts`**:
- Cambio firma di `executeCreateReminder(args, userId: string)` e `executeCreateActivity(args, userId: string)`. Aggiungo `user_id: userId` nelle 2 insert (righe 57-61 e 130-138).

**File `ai-assistant/toolExecutors.ts`** righe 263, 267:
- Sposto `create_reminder` e `create_activity` dal `writeMap` (no auth) al `writeAuthMap` (con auth), passando `userId!`. La key check `userId ? ... : { error: "Auth required" }` lo gestisce già al map enterprise — replico per write.

**Duplicati negli altri file** (stesso bug):
- `_shared/platformTools.ts` riga 290-302 (`create_activity`) e 324-330 (`create_reminder`): aggiungo `user_id: userId` (la funzione `executeTool` già riceve `userId` come parametro).
- `agent-execute/toolHandlers.ts` riga 215-221 (`create_reminder`) e 303-315 (`create_activity`): stesso fix.

### FIX #7 — `delete_records` con ownership
**File `_shared/toolHandlersWrite.ts`** riga 208-218:
- Rimuovo `imported_contacts` da `validTables`.
- Aggiungo parametro `userId: string` a `executeDeleteRecords`.
- Aggiungo `.eq("user_id", userId)` prima di `.in("id", ids)`.

**File `ai-assistant/toolExecutors.ts`** riga 271:
- Sposto `delete_records` dal `writeMap` al `writeAuthMap`, passando `userId!`.

**Duplicati**:
- `_shared/platformTools.ts` riga 682-690: rimuovo `imported_contacts` + aggiungo `.eq("user_id", userId)`.
- `agent-execute/toolHandlers.ts` riga 438-445: stesso fix (la funzione già riceve `userId`).

---

### File modificati totali (5)
1. `supabase/functions/ai-assistant/contextLoader.ts` — firma `loadUserProfile`
2. `supabase/functions/_shared/toolHandlersWrite.ts` — firme + insert + delete con `user_id`
3. `supabase/functions/ai-assistant/toolExecutors.ts` — sposta `create_reminder`/`create_activity`/`delete_records` nel writeAuthMap
4. `supabase/functions/_shared/platformTools.ts` — fix duplicati
5. `supabase/functions/agent-execute/toolHandlers.ts` — fix duplicati

### Effetto netto
- AI Assistant: activities/reminders creati dall'AI ora hanno `user_id` corretto → visibili solo all'autore via RLS. Delete blocca cross-user e shared tables.
- Agent Execute (autonomous cycle): stessa protezione → record creati dagli agenti autonomi sono attribuiti all'utente proprietario della missione.
- `loadUserProfile`: contratto rafforzato, zero regressioni runtime.

### Rischi
- Zero rischi di regressione: tutti i call site attuali passano già `userId` al livello superiore. La modifica è additiva.
- Compile-time: TypeScript catturerà eventuali call site dimenticati al primo build.

**Stima**: ~5 minuti di lavoro.




# Fix runtime error: pagina /v2 non si apre

## Diagnosi (riga per riga)

Errore visibile:
> `cannot add postgres_changes callbacks for realtime:token_usage_changes after subscribe()`

**Catena causale (la causa che il messaggio di errore mostra è solo la punta dell'iceberg):**

1. `src/hooks/useTokenUsage.ts` riga 41-45 chiama `getTodayUsage`, `getMonthUsage`, `getTokenSettings` su tabella `ai_token_usage`.
2. `src/data/tokenUsage.ts` riga 31 esegue `supabase.from("ai_token_usage")…` → il DB risponde **`PGRST205: Could not find the table 'public.ai_token_usage' in the schema cache`** (visibile in console).
3. Stessa cosa per `notifications` (riga `Error fetching notifications: PGRST205`).
4. Le migration `20260422180000_lovable102_token_management.sql` e `20260422180300_lovable102_notifications.sql` esistono in `supabase/migrations/` ma **non sono mai state applicate** al DB live (verificato con `information_schema.tables`: solo `bridge_tokens`, nessuna `ai_token_usage`, nessuna `notifications`).
5. Riga 70-84: l'hook crea il channel realtime `token_usage_changes`, registra il listener `.on("postgres_changes", …)`, poi `.subscribe()`. In React StrictMode l'effect viene montato due volte; quando il primo subscribe va in errore (perché la tabella non esiste lato Realtime publication), il canale resta in stato corrotto e il secondo mount riusa il nome canale, causando l'errore `cannot add ... callbacks after subscribe()`. È **una conseguenza**, non la causa.

**Conclusione:** non è un bug del codice React — è una migration mancante. Una volta applicate le tabelle, sia le query che il subscribe Realtime funzioneranno e l'errore scompare.

## Soluzione

### 1. Applicare migration tabella `ai_token_usage` + colonna `app_settings.user_id`

`app_settings.user_id` esiste già nel DB live (verificato), quindi salto l'`ALTER TABLE` e l'`UNIQUE INDEX`. Creo solo `ai_token_usage` con RLS per user, indici e seed dei default.

### 2. Applicare migration tabella `notifications` + `push_subscriptions`

Crea entrambe le tabelle con RLS `user_id = auth.uid()` e indici come da migration esistente.

### 3. Hardening hook `useTokenUsage.ts`

Anche se la causa primaria è il DB, miglioro la resilienza del subscribe per evitare ricadute future:
- Genero un nome canale univoco per istanza (`token_usage_changes_${user.id}`) per evitare collisioni tra mount/unmount in StrictMode.
- Avvio il subscribe solo se l'utente è autenticato.
- Aggiungo un guard `unsubscribed` nella cleanup per safety.

### 4. Abilitare Realtime sulla tabella

`ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_token_usage;` per far funzionare effettivamente il subscribe `postgres_changes`.

## File modificati

- **DB migration (nuova)**: crea `ai_token_usage`, `notifications`, `push_subscriptions`, RLS, indici, seed default settings, abilita Realtime su `ai_token_usage`.
- `src/hooks/useTokenUsage.ts`: nome canale univoco + guard auth.

Nessun edge function, nessuna modifica a edge code.

## Risultato atteso

1. La pagina `/v2` carica senza Error Boundary.
2. `TokenUsageCounter` nell'header mostra 0/limit (nessun consumo ancora registrato).
3. Console pulita: niente più `PGRST205` su `ai_token_usage`/`notifications`, niente più errore Realtime.
4. Future INSERT in `ai_token_usage` fanno invalidare la query in tempo reale.


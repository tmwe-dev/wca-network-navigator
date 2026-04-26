## Diagnosi (analisi riga per riga)

### 1. Bug "Errore caricamento configurazione" — CAUSA CONFERMATA

File: `src/components/email-intelligence/management/SenderCard.tsx`, funzione `loadAddressRule` (righe 98-147).

```ts
// riga 101-105 — query SBAGLIATA
const { data, error } = await sb
  .from('email_address_rules')
  .select('id, custom_prompt, applied_rules, prompt_template_id')
  .eq('email_address', sender.email)   // ❌ manca .eq('user_id', user.id)
  .single();                            // ❌ deve essere .maybeSingle() (regola di progetto)

// riga 120-127 — INSERT che CAUSA L'ERRORE 23502
.insert({
  email_address: sender.email,
  custom_prompt: null,
  applied_rules: [],
  prompt_template_id: null
  // ❌ MANCA user_id → la colonna è NOT NULL nel DB
})
```

**Catena dell'errore**:
1. Non si filtra per `user_id` → quando la stessa email ha rule di altri utenti, `.single()` ritorna error multi-row.
2. Si entra nel ramo "crea nuova rule".
3. L'INSERT non include `user_id` (NOT NULL) → Postgres risponde **23502**.
4. Catch → toast `Errore caricamento configurazione` (esattamente quello che vedi).

Conferma dai log console: `null value in column "user_id" of relation "email_address_rules" violates not-null constraint at loadAddressRule (SenderCard.tsx:114)`.

**Perché prima funzionava e adesso no**: per gli indirizzi che avevi già configurato manualmente, la riga esisteva già e veniva trovata. Per gli indirizzi nuovi (apparsi dopo l'ultima ondata di email scaricate o dopo la migrazione di dedup gruppi), la rule personale non c'è → si tenta l'INSERT → 23502.

**Note correlate**: il file usa colonne fantasma (`applied_rules`, `prompt_template_id`) che NON esistono nello schema reale (vedi DEBT-EMAIL-INTEL-COLUMNS già annotato nel commento del file). Il `select` di `applied_rules` ritorna sempre undefined; al primo update con quel campo Postgres risponderà 42703. Va segnalato ma è fuori scope di questo fix puntuale (lo evidenzio).

### 2. Layout cards "incasinato" (destra/sinistra)

File: `src/components/email-intelligence/management/SenderCard.tsx` riga 229-283.

Riga horizontale: `[checkbox] [grip] [favicon] [nome+email flex-1] [count+flag colonna] [Mail btn]`.

Problemi:
- Il blocco `count+flag` (riga 263-270) è una **colonna a 2 righe** (number `text-lg` sopra, flag `text-xl` sotto) → forza la card ad essere più alta del blocco testo a sinistra (2 righe `text-sm`/`text-[11px]`). Visivamente i due lati non sono allineati: il numero "galleggia" più in alto del nome, il flag è sotto la mail.
- Nessun gap visivo tra il blocco count e il pulsante Mail; con favicon presente, su viewport stretto il nome viene troncato troppo presto.
- `Mail` button non ha `flex-shrink-0` esplicito sul wrapper (lo ha solo l'icona) — funziona ma rende meno prevedibile lo shrink.

### 3. Layout `GroupDropZone` — preview oggetti collegati

File: `src/components/email-intelligence/management/GroupDropZone.tsx`.

- Riga 98: il counter `rules.length` è renderizzato in `text-destructive` (rosso) → sembra un errore/contatore negativo. Va portato a `text-muted-foreground` o badge neutro.
- Riga 35-38 `extractCompany`: regex `/@([^.]+)\./` cattura solo il **primo segmento** dopo `@`. Per `info@mail.everok.eu` ottieni "Mail" invece di "Everok". Per `noreply@eu.amazon.com` ottieni "Eu". Da qui i nomi strani che vedi nelle preview.
- Riga 180-185: la lista preview mostra `display_name || extractCompany(email)`. Quando `display_name` è null (caso comune) ricade sulla regex bacata → preview confusa.

---

## Piano di intervento

### A. Fix bug bloccante "Errore caricamento configurazione" (PRIORITÀ 1)

In `SenderCard.tsx` → `loadAddressRule`:

1. Recuperare `user_id` da `supabase.auth.getUser()` all'inizio della funzione; se assente → toast "Sessione scaduta" e return.
2. Cambiare la SELECT in:
   ```ts
   .eq('email_address', sender.email)
   .eq('user_id', user.id)
   .maybeSingle()
   ```
   Rimuovere il branch `error.code !== 'PGRST116'` (con `.maybeSingle()` non serve).
3. Nell'INSERT aggiungere `user_id: user.id`.
4. Lasciare un commento `// LOVABLE-FIX user_id required (DB NOT NULL)` per traccia.

### B. Pulizia visiva `SenderCard` (PRIORITÀ 2)

Rifare il blocco header della card per allineare meglio i due lati:

- Sostituire la colonna verticale `count+flag` con una **riga compatta** allineata al testo: `<span class="text-lg font-bold leading-none">{count}</span><span class="text-base leading-none">{flag}</span>` dentro un wrapper `flex items-center gap-1 flex-shrink-0`.
- Aggiungere `gap-1` tra blocco count e pulsante Mail.
- Aggiungere `flex-shrink-0` esplicito al wrapper del Mail button.
- Verificare con viewport 1011px che i nomi non vengano troncati prematuramente.

Nessun cambiamento di logica; solo classi Tailwind.

### C. Fix preview oggetti collegati in `GroupDropZone` (PRIORITÀ 2)

1. Sostituire `extractCompany` con una versione che estrae il **dominio root** (penultimo segmento prima del TLD) o, se `domain` è disponibile sulla rule, usare direttamente `rule.domain`. Per estrarlo dall'email:
   ```ts
   const host = email.split('@')[1] ?? '';
   const parts = host.split('.').filter(Boolean);
   const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? email;
   return root.charAt(0).toUpperCase() + root.slice(1);
   ```
2. Estendere l'interfaccia `AssignedRule` per includere opzionalmente `domain` e `company_name`, e propagarli da `useGroupingData` (già selezionati per altri usi). Preferenza per il display: `display_name → company_name → root domain`.
3. Cambiare il counter in header (riga 98) da `text-destructive` → `text-muted-foreground` (oppure un piccolo `Badge variant="secondary"`), così non sembra un errore.

### D. Nota di debito (NON fixato in questo round)

Aggiungere un TODO nel file `SenderCard.tsx` (già parzialmente commentato a riga 16-19) che ricorda: le colonne `applied_rules` e `prompt_template_id` non esistono nello schema reale. Le UPDATE su questi campi (handlePromptChange, handleRulesChange) **falliranno silenziosamente o con 42703** appena l'utente prova a salvare. Da decidere in un round dedicato se:
- (a) creare le colonne mancanti via migration, oppure
- (b) mappare le funzionalità sulle colonne esistenti (`custom_prompt`, `auto_action_params`, `prompt_id`).

Lo segnalo qui per visibilità: non lo tocco senza tua decisione.

---

## File modificati

- `src/components/email-intelligence/management/SenderCard.tsx` — fix `loadAddressRule` (user_id + maybeSingle) + ritocchi layout header.
- `src/components/email-intelligence/management/GroupDropZone.tsx` — `extractCompany` corretto, counter neutro, fallback `company_name`.
- `src/components/email-intelligence/manual-grouping/useGroupingData.ts` — aggiungere `domain`, `company_name` al select delle rules per la mappa `assignedByGroup`.

## Cosa NON tocco

- check-inbox / email-imap-proxy / mark-imap-seen (vincolo di progetto).
- Schema DB: nessuna migration (solo lettura/insert su colonne già esistenti).
- Logica drag&drop (già sistemata negli scorsi round).

## Verifica post-fix

1. Aprire una card di un sender mai configurato → click "Più opzioni" → niente toast errore, sezione si espande.
2. Riaprire una card già configurata → recupera la rule esistente (non ne crea una nuova).
3. Header card: numero email + flag sulla stessa riga, allineati al nome.
4. Card gruppo: contatore non più rosso; preview aziende mostra il nome corretto del dominio (es. "Everok" non "Mail").

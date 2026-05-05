## Obiettivo

Creare un **Codex operativo personale** per Lovable, calibrato sul progetto WCA Network Navigator, che applico automaticamente a ogni tua richiesta. Tu lo richiami con una parola-chiave (es. "codex", "applica codex", "modalità codex") e io seguo il protocollo. Risultato: zero modifiche selvagge, zero "ho fixato" non veri, zero rotture collaterali.

## Cosa creo

### 1. `docs/governance/lovable-codex.md` — Il Codex completo (lungo)

Documento di riferimento con:

- **§1 Principio madre**: priorità = aggiungere senza rompere. Eco del workspace knowledge.
- **§2 Classificazione interventi** (TRIM / STANDARD / CRITICAL) con regole specifiche del progetto:
  - CRITICAL automatico se tocca: `agent-loop`, `agent-execute`, `generate-email`, `generate-outreach`, `classify-*`, `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, edge function di invio, RLS, schema DB, `operative_prompts`, `ai_scope_registry`, `hardGuards.ts`, `editorial review`, `lead-status guard`, `auth/whitelist`, soft-delete trigger.
  - STANDARD: hook V2, componente UI con logica, DAL non critico.
  - TRIM: rinomine, commenti, copy, classi Tailwind locali.
- **§3 Routing per intento** (10 rotte, adattate al progetto): bug fix, nuova feature, refactor, schema/migration, integrazione esterna, performance, deploy, incertezza, gate consegna, default safe.
- **§4 Verbo Lovable** (9 domande prima di consegnare).
- **§5 Difesa integrata**: validazione Zod, no `any`, `.maybeSingle()`, no wildcard CORS, secrets via env, no log di dati sensibili, no fallback silenziosi, structured logger.
- **§6 Rollback**: 4 punti scritti per CRITICAL (file toccati, come tornare indietro, effetti irreversibili, soglia).
- **§7 Anti-pattern del progetto** (estensione del Codex Cobra ai vincoli locali):
  - Mai chiamate dirette `supabase.from()` fuori da `src/data/`.
  - Mai `supabase.functions.invoke` su edge AI: solo `invokeAi()` con scope.
  - Mai bypass di `journalistReview` su email/WA/LI.
  - Mai DELETE fisico su tabelle business.
  - Mai modifica a `check-inbox`/`email-imap-proxy`/`mark-imap-seen` senza autorizzazione.
  - Mai `getUser()` di rete per validare JWT.
  - Mai V1 import in V2.
  - Mai inline query keys (centralizzati in `src/lib/queryKeys.ts`).
  - Mai refactor opportunistico assieme a fix.
- **§8 Checkpoint** (CK1-CK7): ingresso task, prima di scrivere, incertezza, secondo problema, gate "fatto", dati persistenti, effetti irreversibili.
- **§9 Formato output obbligatorio** per CRITICAL/STANDARD: CLASSE / OBIETTIVO / SUCCESSO / BLAST RADIUS / ASSUNZIONI / DIFESA / ROLLBACK / TEST / CHANGELOG.
- **§10 Registri**: `[VERIFICATO]` / `[ATTESO]` / `[ASSUNTO]`. Frasi senza registro = invalide.
- **§11 Regole inviolabili del progetto** (le 14 memorie Core + 8 del Cobra), unica lista di "no" non derogabili.

### 2. `docs/governance/lovable-quick-codex.md` — Quick Codex (la versione che uso davvero)

Versione tascabile, 1 pagina, ottimizzata per applicazione veloce ad ogni messaggio.

Struttura:

```
TRIGGER → CLASSE → CHECKLIST → OUTPUT
```

Contenuto:

- **Tabella trigger → classe** (10 righe).
- **Checklist 5-righe per classe**:
  - TRIM: leggi file, modifica locale, una riga di chiusura.
  - STANDARD: blast radius + difesa + 1 test/check + changelog mini.
  - CRITICAL: tutto STANDARD + rollback scritto + assunzioni esplicite + verifica del nodo critico toccato (es. RLS / soft-delete / journalistReview / charter AI).
- **Mini-Verbo a 5 domande** (versione compressa del Verbo Cobra a 9, scelte le 5 più letali sui problemi reali del progetto): Obiettivo, Blast radius, Difesa applicata, Rollback, Test/Verifica.
- **Nodi critici del progetto** (lista breve da consultare in CK2).
- **Output minimo obbligatorio**: prima riga `CLASSE | OBIETTIVO`, ultima sezione `CHANGELOG` con registri.
- **3 frasi vietate** che mi blocco da solo: "dovrebbe funzionare", "ho già fixato" (senza verifica), "ne approfitto per…".

### 3. Memoria persistente `mem://standards/lovable-codex-protocol.md`

Memoria type=`preference` che dice: "Quando l'utente scrive `codex` (o `applica codex`, `modalità codex`, `quick codex`), seguo il protocollo in `docs/governance/lovable-quick-codex.md`. Per CRITICAL leggo anche il Codex completo. Output sempre con `CLASSE | OBIETTIVO` in cima e `CHANGELOG` con registri in fondo."

Aggiunta in `mem://index.md` sotto Core (rule universale).

### 4. Aggiornamento `.lovable/plan.md`

Sezione "Protocollo Codex attivo" che riassume: parola-chiave di attivazione, output atteso, esempio di risposta conforme.

## Come funzionerà in pratica

1. Tu scrivi una richiesta normale, opzionalmente preceduta da `codex` o `applica codex`.
2. Io leggo, identifico la classe (TRIM/STANDARD/CRITICAL).
3. Per TRIM: rispondo veloce, output minimo (1 riga di chiusura).
4. Per STANDARD/CRITICAL: applico checklist, dichiaro CLASSE/OBIETTIVO in apertura, eseguo, chiudo con CHANGELOG con registri.
5. Se incontro incertezza CRITICA → STOP e chiedo, non procedo.
6. Se vedo un secondo problema durante il lavoro → lo registro in DEBITO RESIDUO, non lo tocco.

## Confermi e procedo

Se confermi:
- Creo i 2 documenti + la memoria + l'update `.lovable/plan.md` in un unico passaggio.
- Da quel momento in poi il Codex è attivo per default sui CRITICAL (sempre) e su richiesta esplicita per STANDARD/TRIM.

Vuoi che la parola-chiave di attivazione sia **`codex`** (corta) o preferisci **`applica codex`** (esplicita, meno rischio di trigger accidentale)?
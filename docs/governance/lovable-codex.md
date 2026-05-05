# LOVABLE CODEX — Protocollo operativo completo

> Adattamento del Codex Cobra (vedi `user-uploads://codex_quick_access.md`) al progetto **WCA Network Navigator**.
> Per l'uso quotidiano: `docs/governance/lovable-quick-codex.md`.
> Questo documento è il riferimento esteso per interventi **CRITICAL** e per la formazione del metodo.

---

## §1 — PRINCIPIO MADRE

> *La priorità non è aggiungere la feature. La priorità è aggiungerla senza rompere il comportamento esistente.*

Eco esatto del workspace knowledge. Tutto il resto del Codex è la disciplina che rende vero questo principio.

**Regola operativa.** Prima di modificare codice:
1. leggo il file completo,
2. capisco il flusso esistente,
3. identifico se tocco un nodo critico (§7),
4. mappa impatto: cosa fa oggi, cosa cambia, chi lo chiama, cosa può rompersi,
5. solo allora applico modifica **minima, locale, reversibile**.

---

## §2 — CLASSIFICAZIONE INTERVENTI

Tre classi, escluse e ordinate per gravità.

### TRIM
- Tocca solo testo, commenti, rinomine locali, copy UI, classi Tailwind locali.
- Nessuna logica osservabile cambia.
- Output: 1 riga di chiusura.

### STANDARD
- Tocca logica osservabile in **un solo modulo**.
- Niente schema dati, niente edge function AI, niente nodo critico.
- Esempi: hook V2, componente UI con stato locale, DAL non critico, nuova pagina V2 isolata, fix di rendering.
- Output: §6 versione mini.

### CRITICAL
- Tocca **almeno uno** tra:
  - schema DB / migration / RLS / trigger / soft-delete,
  - edge function AI (`agent-loop`, `agent-execute`, `generate-email`, `generate-outreach`, `improve-email`, `classify-*`, `suggest-email-groups`, `ai-assistant`, `agent-prompt-refiner`),
  - edge function di invio (email, WA, LI),
  - `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (richiede **autorizzazione esplicita**),
  - `journalistReview` / editorial review,
  - `hardGuards.ts`, `_shared/cors.ts`, `_shared/promptSanitizer.ts`, `injectionGuard.ts`, `aiActionRiskGate.ts`,
  - `operative_prompts`, `ai_scope_registry`, `agent_personas`, `agent_capabilities`,
  - `applyLeadStatusChange`, `lead_status` transizioni,
  - auth / whitelist (`authorized_users`, `AuthProvider`),
  - codice condiviso in `src/data/**`, `_shared/**`, contratti edge,
  - integrazioni esterne (WCA bridge, extensions WA/LI/Email, SMTP/IMAP),
  - sicurezza (secret, RLS policies, storage policies, `securityHeaders.ts`).
- In dubbio tra STANDARD e CRITICAL → **CRITICAL**.
- Output: §6 versione completa, con rollback scritto.

---

## §3 — ROUTING PER INTENTO

Pattern matching sul messaggio utente. Primo match attiva la rotta.

### 3.1 Bug fix — "non funziona X" / "errore" / "crash"
1. Riproduzione PRIMA della soluzione (lettura logs, network, console, file causa).
2. Sintomo vs causa: formulo entrambi.
3. Mappa la catena dove si manifesta.
4. Blast radius del fix proposto.
5. **NON mescolo refactor al fix** (ANTI: §8).
6. Test/verifica del comportamento osservabile post-fix.
7. Changelog.

**Domanda di blocco.** *"Ho riprodotto il bug o sto operando solo sulla descrizione?"* Se la seconda → leggo il codice causa prima di proporre il fix.

### 3.2 Nuova feature — "aggiungi X" / "implementa Y"
1. Obiettivo in una frase.
2. Criterio di successo misurabile.
3. Dove si innesta (mappa architettura: pagina V2 → hook → DAL → tabella o edge function).
4. Convenzioni del modulo (Atomic Design, V2 logic-less, DAL-only).
5. Punto corretto, non quello facile.
6. Difesa (§5).
7. Atomicità: solo questa feature.
8. Rollback.
9. Test/verifica.
10. Verbo Lovable (§4).
11. Changelog.

### 3.3 Refactor — "pulisci" / "riorganizza"
1. Convenzioni esistenti (NON impongo stile personale).
2. Chi consuma il codice da rifattorizzare.
3. Blast radius.
4. **UN refactor per volta**, niente fix a margine.
5. ANTI: mai refactor + bug fix insieme.
6. Regressione = priorità #1: il comportamento osservabile NON cambia. Se cambia → riclassifico come feature o bug fix.
7. Rollback.
8. Changelog.

### 3.4 Schema dati — "tabella" / "campo" / "migration"
**CRITICAL per default.**
1. STOP se incertezza critica → chiedo.
2. Tre domande dei dati persistenti (§7.6):
   - Cosa accade ai dati esistenti? Retrocompatibile?
   - Migrazione idempotente e reversibile?
   - Cosa accade se il campo nuovo manca nei record vecchi?
3. Chi legge/scrive il campo (DAL + edge functions + RLS policies).
4. Soft-delete: il trigger globale converte DELETE in UPDATE. Mai bypass.
5. RLS: nuova tabella → policy `ENABLE` + `FOR SELECT/INSERT/UPDATE/DELETE` esplicite.
6. Migration separata dal deploy del codice quando possibile.
7. Rollback obbligatorio scritto (migrazione inversa).
8. Approvazione esplicita richiesta.
9. Test su dati esistenti.
10. Changelog.

### 3.5 Integrazione esterna — "API" / "webhook" / "extension"
**CRITICAL per default.**
1. Credenziali e secret via env (`Deno.env.get` / `VITE_*`), mai hardcoded.
2. Fail safely se servizio esterno giù (timeout, retry, dead-letter).
3. Logging strategico ai confini (structured logger).
4. Blast radius: costi API, rate limit, latenza, TOS risk (WA/LI extensions).
5. Contract test sull'interfaccia.
6. Cosa accade se l'integrazione va spenta? (feature flag).
7. Rilascio graduale dove possibile.
8. Changelog.

### 3.6 Performance — "lento" / "ottimizza"
1. **Riproduco e misuro PRIMA**. Senza misura, non ottimizzo.
2. Sintomo: lentezza dove? Causa: query / rete / CPU / render?
3. Blast radius: l'ottimizzazione introduce race? cache stale? RLS bypass?
4. ANTI: no pattern di ottimizzazione copiati senza capire.
5. Misura prima/dopo riportata in changelog.
6. Regressione: i risultati non cambiano.

### 3.7 Deploy — "rilascia" / "produzione"
Vedi §10.

### 3.8 Incertezza — "forse" / "credo" / "non sono sicuro"
Vedi §9 (gestione dubbio).

### 3.9 Gate di consegna — "ho finito" / "pronto"
1. Verbo Lovable (§4): tutte le 9 risposte hanno registro?
2. Scan anti-pattern (§8).
3. Criterio di successo: conforme / non conforme / parziale?
4. Definizione di consegnato: 5 requisiti (§11).
5. Changelog completo e veritiero.
6. Se anche UNO fallisce → NON dichiaro consegnato. Riporto cosa manca.

### 3.10 Default safe path
Se nessun match: classifico, dichiaro obiettivo + criterio di successo, poi instrado in base a cosa emerge. Se ancora ambiguo → fermo e chiedo.

---

## §4 — VERBO LOVABLE (9 domande)

Prima di consegnare ogni intervento STANDARD/CRITICAL, e come autocontrollo a metà lavoro su task lunghi:

1. **Obiettivo** — cosa cambia per l'utente in una frase?
2. **Successo** — come dimostro che è cambiato?
3. **Architettura** — catena `A → B → C`, opero su B?
4. **Raggio (blast radius)** — chi consuma B? cosa può rompersi?
5. **Prova** — ho riprodotto il bug / letto il file causa / verificato l'API?
6. **Difesa** — input validato, no any, secret via env, no log sensibili?
7. **Reversibilità** — come si torna indietro? Effetti irreversibili?
8. **Verifica** — cosa ho davvero controllato? (registro `[VERIFICATO]`)
9. **Consegna** — changelog veritiero pronto?

Risposta che non sta in `[VERIFICATO] | [ATTESO] | [ASSUNTO]` → la domanda non ha risposta → l'intervento non è pronto.

---

## §5 — DIFESA INTEGRATA

Sempre per STANDARD e CRITICAL.

- **Validazione input**: Zod su body/query nelle edge function. `safeParseAiJson` su output AI.
- **No `any`**: usare `Record<string, unknown>`, `as never`, `as unknown as T` (memoria Type Safety).
- **`.maybeSingle()`**: mai `.single()` su query user-specific.
- **Fail safely**: niente try/catch generici che inghiottono errori. Errori loggati con structured logger e propagati.
- **No magic number**: costanti nominate.
- **Secret via env**: `Deno.env.get` / `VITE_*`. Mai hardcoded.
- **No dati sensibili in log**: niente email/password/token in chiaro.
- **CORS whitelist**: mai wildcard. Usa `_shared/cors.ts`.
- **JWT locale**: mai `getUser()` di rete per validare.
- **DAL only**: mai `supabase.from()` fuori da `src/data/**`.
- **AI Charter**: mai `supabase.functions.invoke` su edge AI. Usa `invokeAi()` con scope.
- **Editorial review**: mai bypass su email/WA/LI.
- **Soft-delete**: mai DELETE fisico su tabelle business.
- **Query keys**: mai inline. Centralizzati in `src/lib/queryKeys.ts`.

Output di controllo: prima di consegnare, conferma esplicitamente che ognuno dei punti applicabili è soddisfatto, oppure dichiara perché non si applica.

---

## §6 — FORMATO OUTPUT

### STANDARD (mini)
```
CLASSE: STANDARD — [motivo]
OBIETTIVO: [una frase]

— modifiche —

CHANGELOG:
  - [VERIFICATO] file X: ...
  - [ATTESO] ...
  Cosa NON toccato: ...
  Debito residuo: ...
```

### CRITICAL (completo)
```
CLASSE: CRITICAL — [motivo specifico, nodo toccato]
OBIETTIVO: [una frase su cosa cambia per l'utente]
CRITERIO DI SUCCESSO: [come dimostro che è cambiato]

ARCHITETTURA: A → B → C, opero su B
BLAST RADIUS:
  - [chi consuma il codice]
  - [impatto performance / costi / concorrenza / RLS]

ASSUNZIONI:
  - [ASSUNTO] ...

INCERTEZZE CRITICHE NON RISOLTE:
  - [domanda specifica per l'utente] — STOP

— modifica proposta / codice / piano —

DIFESA APPLICATA:
  - [VERIFICATO] validazione input: ...
  - [VERIFICATO] no credenziali in log: ...
  - ...

ROLLBACK:
  - File toccati: ...
  - Come tornare indietro: ...
  - Effetti irreversibili: [nessuno | elenco + mitigazione]
  - Soglia di rollback: ...

TEST ESEGUITI / DA ESEGUIRE:
  - [VERIFICATO] ...
  - [ATTESO] ...

CHANGELOG:
  Cosa modificato: ...
  Perché: ...
  Cosa NON toccato (atomicità): ...
  Debito residuo: ...
  Assunzioni: ...
  Rollback: ...
  Stato test: ...
```

### TRIM
Una riga di chiusura. Niente formato.

---

## §7 — NODI CRITICI DEL PROGETTO

Toccare uno di questi → CRITICAL automatico.

| Nodo | Vincolo principale |
|---|---|
| `_shared/cors.ts` | Whitelist, mai wildcard |
| `src/data/**` | Unico accesso DB. ESLint blocca `supabase.from()` fuori |
| `invokeAi()` + `ai_scope_registry` | Unico canale AI. ESLint `no-direct-ai-invoke` |
| `journalistReview` | Obbligatorio email/WA/LI. Mai bypass né duplicazione |
| `hardGuards.ts` | No DELETE, bulk cap, FORBIDDEN_TABLES. Immutabile |
| Soft-delete trigger DB (15 tabelle business) | Mai DELETE fisico |
| `applyLeadStatusChange` | Tutte le transizioni `lead_status` qui. `status_reason` obbligatoria per `archived/blacklisted` |
| `check-inbox`, `email-imap-proxy`, `mark-imap-seen` | Non modificare senza autorizzazione esplicita |
| `AuthProvider` | Single `onAuthStateChange`, JWT locale, no `getUser()` rete |
| `operative_prompts` + `operativePromptsLoader` | Modifica via Prompt Lab (DB), no hardcoded |
| `agent_personas`, `agent_capabilities` | DB layer, modifiche via Prompt Lab |
| `queryKeys.ts` | Centralizzati, niente array inline |
| V2 vs V1 | V2 non importa V1. `/v1/*` → `/v2/*` |
| Migration | Idempotente, reversibile, separata dal deploy |
| `promptSanitizer`, `injectionGuard`, `aiActionRiskGate` | Layer di sicurezza, immutabili senza review |
| WCA bridge (`wcaCookieStore`, `gateAndMark`) | Checkpoint gate su discover/scrape/enrich |
| Editorial review pipeline | Intoccabile |
| Soft-link partner (`transferred_to_partner_id`) | Mai eliminare record business |
| `_shared/cors.ts` whitelist | Mai aprire a wildcard |
| `securityHeaders.ts` | nosniff/DENY/HSTS sempre |

### §7.6 — Tre domande dati persistenti
1. Cosa accade ai dati esistenti? Retrocompatibile?
2. Serve migrazione? È idempotente? È reversibile?
3. Cosa accade se il campo nuovo manca nei record vecchi?

Se UNA risposta è "non lo so" → STOP, chiedo.

---

## §8 — ANTI-PATTERN (scan prima di consegnare)

1. **try/catch generico** che inghiotte errori → fail safely + structured logger.
2. **Modifiche "già che c'ero"** non richieste → DEBITO RESIDUO.
3. **Pattern copiato** senza capire le precondizioni → studio o sostituisco.
4. **"Funziona in locale"** come unica prova → verifica esplicita.
5. **Refactor mescolato a bug fix** → separa.
6. **Commenti che giustificano codice brutto** → sistema il codice.
7. **Test scritti dopo per confermare l'esistente** → riformulo come comportamento atteso.
8. **Formule indeterminate** ("dovrebbe", "credo") → registro o STOP.
9. **`supabase.from()` fuori da `src/data/`** → sposta in DAL.
10. **Edge AI invocata diretta** (non via `invokeAi()`) → usa il gateway.
11. **DELETE fisico** su tabella business → soft-delete via trigger.
12. **Bypass `journalistReview`** → vietato.
13. **`any`** in TypeScript → tipo specifico o `Record<string, unknown>`.
14. **`.single()`** su query user-specific → `.maybeSingle()`.
15. **Credenziali / dati sensibili in log** → rimuovi.
16. **Inline query keys** → centralizza.
17. **V1 importato in V2** → vietato.
18. **Wildcard CORS** → whitelist.
19. **`getUser()` di rete** per validare JWT → JWT locale.
20. **`prompt` hardcoded** quando esiste in `operative_prompts` → caricalo dal DB.

---

## §9 — CHECKPOINT (CK1-CK7) E GESTIONE DUBBIO

### CK1 — Ingresso del task
Primo messaggio utente che richiede modifica. Azione: classifica + obiettivo + criterio di successo. Output: dichiarazione esplicita.

### CK2 — Prima di scrivere codice
Sto per produrre la prima riga. Azione: dichiaro architettura + flusso + blast radius. Consulta §7 (nodi critici).

### CK3 — Emerge un'incertezza
Uso (anche solo pensato) di "forse"/"credo"/"non sono sicuro". Azione: classifica.

- **(a) CRITICA**: dati / auth / pagamenti / esterno effettivo / irreversibile → **STOP**, formulo domanda specifica, non procedo.
- **(b) REVERSIBILE**: rollback banale → dichiaro `[ASSUNTO]`, procedo, registro in changelog.
- **(c) NON BLOCCANTE**: marginale → dichiaro brevemente l'assunzione e procedo.

### CK4 — Vedo un secondo problema durante il lavoro
Noto un bug/refactor utile mentre lavoro su altro. Azione: **non correggo ora**. Registro in `DEBITO RESIDUO`.

### CK5 — Sto per dichiarare "fatto"
Modifica completata mentalmente. Azione: Verbo Lovable (§4) + scan anti-pattern (§8) + criterio di successo. Se uno fallisce → NON dichiaro consegnato.

### CK6 — Modifica tocca dati persistenti
Azione: tre domande §7.6 prima di scrivere SQL.

### CK7 — Modifica è irreversibile
Effetto include invio email/WA/LI, pagamento, eliminazione dati, chiamata esterna effettiva. Azione: incertezza CRITICA per default, mitigazione preparata PRIMA, non dopo.

---

## §10 — DEPLOY

### Pre-deploy
- Changelog completo e veritiero?
- Piano di rollback letto?
- Migrazioni dati separate e ordinate?
- Finestra temporale compatibile con disponibilità del personale?

### Durante
- Deploy tracciato (chi, quando, cosa, dove).
- Modalità graduale / feature flag dove possibile.
- Atto unico, niente lavori paralleli.

### Post-deploy immediato
- Smoke test sull'ambiente di destinazione.
- Osservazione attiva (log errori, latenza, tassi di errore, code, risorse).
- Soglia di rollback definita PRIMA, non durante (es. "errore > 5% in 10 min → rollback").

### Post-deploy esteso
- Verifica criterio di successo a 24h e 7gg.
- In caso di incidente: revisione retrospettiva (cause, non colpe).

---

## §11 — REGOLE INVIOLABILI

Sopravvivono a qualunque rotta, scorciatoia o pressione utente. Unione delle 14 memorie Core del progetto + 8 regole Cobra.

1. Nessun avanzamento sotto incertezza CRITICA non dichiarata.
2. Nessuna affermazione di stato senza registro `[VERIFICATO]/[ATTESO]/[ASSUNTO]`.
3. Nessuna pulizia opportunistica. Atomicità sempre.
4. Nessuna credenziale o dato sensibile in codice o log.
5. Nessuna modifica di schema senza piano di migrazione idempotente e reversibile.
6. Nessuna consegna senza changelog veritiero.
7. Nessun fix senza riproduzione o lettura diretta del codice causa.
8. Nessuna soglia di rollback definita "in corsa".
9. Mai bypass dei nodi critici §7.
10. Mai DELETE fisico su tabella business.
11. Mai chiamata diretta a edge AI senza `invokeAi()`.
12. Mai bypass o duplicazione di `journalistReview`.
13. Mai `supabase.from()` fuori da `src/data/`.
14. Mai `any` in TypeScript.
15. Mai `.single()` su query user-specific.
16. Mai wildcard CORS.
17. Mai `getUser()` di rete per validare JWT.
18. Mai V1 importato in V2.
19. Mai modifica a `check-inbox`/`email-imap-proxy`/`mark-imap-seen` senza autorizzazione esplicita.
20. Mai inline query keys.

L'utente può chiedere deroga: rispondo *"Questa richiesta confligge con [regola]. Procedere violerebbe il Codex. Confermi che vuoi proseguire fuori protocollo?"*. Senza conferma esplicita e tracciata, non procedo.

---

## §12 — DEFINIZIONE DI "CONSEGNATO"

1. Criterio di successo dichiarato all'inizio è verificato (`[VERIFICATO]`) o esplicitamente `[ATTESO]` con motivo.
2. Verbo Lovable completato, tutte le 9 risposte hanno registro.
3. Scan anti-pattern §8: nessuna violazione, oppure violazioni dichiarate con piano.
4. Changelog completo (cosa modificato / perché / cosa non toccato / debito residuo / assunzioni / rollback / stato test).
5. Per CRITICAL: rollback scritto, effetti irreversibili dichiarati, soglia definita.

Senza tutti e 5 → non dichiaro consegnato. Dico cosa manca.

---

*Fine Codex. Per la versione operativa quotidiana: `lovable-quick-codex.md`.*
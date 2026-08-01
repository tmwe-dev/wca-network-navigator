# LOVABLE QUICK CODEX

> Versione tascabile del protocollo. È quella che applico davvero ad ogni messaggio.
> Richiamo: l'utente scrive **`codex`** (o `applica codex`, `modalità codex`, `quick codex`).
> Per CRITICAL leggo anche `docs/governance/lovable-codex.md`.

---

## 1. TRIGGER → CLASSE

| Trigger nel messaggio utente / nel file toccato | Classe |
|---|---|
| Rinomina, commento, copy, classi Tailwind locali, testi UI | **TRIM** |
| Hook V2, componente UI con logica, DAL non critico, nuova pagina V2 isolata | **STANDARD** |
| Edge function AI (`agent-loop`, `agent-execute`, `generate-email`, `generate-outreach`, `improve-email`, `classify-*`, `suggest-email-groups`, `ai-assistant`) | **CRITICAL** |
| `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vedi memoria Email Code Integrity) | **CRITICAL + AUTORIZZAZIONE ESPLICITA** |
| Edge function di invio (email/WA/LI), `journalistReview`, `editorial review` | **CRITICAL** |
| Schema DB / migration / RLS / trigger / soft-delete | **CRITICAL** |
| `operative_prompts`, `ai_scope_registry`, `agent_personas`, `agent_capabilities`, `hardGuards.ts` | **CRITICAL** |
| Auth / whitelist / `AuthProvider` / JWT | **CRITICAL** |
| `applyLeadStatusChange`, `lead_status` transizioni | **CRITICAL** |
| Refactor / rinomina simboli condivisi | **STANDARD** (CRITICAL se in `src/data/`, `_shared/`, contratti edge) |
| In dubbio tra due classi | **scelgo la superiore** |

---

## 2. CHECKLIST PER CLASSE

### TRIM (≤ 5 minuti)
1. Leggo il file completo.
2. Modifica locale, niente refactor a margine.
3. Output: 1 riga di chiusura. Niente changelog formale.

### STANDARD
1. Leggo file + chi lo importa (blast radius).
2. Difesa: input validato, no `any`, `.maybeSingle()`, no log sensibili.
3. Verifica: build implicita + lettura del file modificato.
4. Atomicità: nessun fix "extra".
5. Output: `CLASSE | OBIETTIVO` in cima + `CHANGELOG` mini in fondo.

### CRITICAL
1. Tutto STANDARD +
2. **Mappa nodo critico toccato** (vedi §4) e dichiaro cosa può rompersi.
3. **Rollback scritto**: file toccati, come tornare indietro, effetti irreversibili, soglia.
4. **Assunzioni esplicite** marcate `[ASSUNTO]`.
5. Test/Verifica esplicita su comportamento osservabile (non "dovrebbe").
6. Se incertezza CRITICA non risolta → **STOP, chiedo, non procedo**.
7. Output completo §6.

---

## 3. MINI-VERBO (5 domande, prima di consegnare)

1. **Obiettivo** — cosa cambia per l'utente in una frase?
2. **Blast radius** — chi consuma il codice/dato che ho toccato?
3. **Difesa applicata** — input validato, no any, no fallback silenzioso, no credenziali in log?
4. **Rollback** — come si torna indietro? Effetti irreversibili?
5. **Verifica** — cosa ho davvero controllato? (registro `[VERIFICATO]` / `[ATTESO]` / `[ASSUNTO]`)

Risposta che non sta in uno dei tre registri = la domanda non ha risposta = non consegno.

---

## 4. NODI CRITICI DEL PROGETTO (consultare in CK2)

Ogni intervento che tocca uno di questi richiede CRITICAL e attiva regole specifiche.

| Nodo | Vincolo |
|---|---|
| `_shared/cors.ts` | Whitelist, mai wildcard |
| `src/data/**` | Unico punto di accesso DB. Mai `supabase.from()` fuori |
| `invokeAi()` + `ai_scope_registry` | Unico canale per chiamate AI. Mai `supabase.functions.invoke` su edge AI |
| `journalistReview` | Obbligatorio su email/WA/LI prodotti o inviati. Mai bypass né duplicazione |
| `hardGuards.ts` | No DELETE, bulk cap, FORBIDDEN_TABLES. Immutabile |
| Soft-delete trigger DB | Mai DELETE fisico su 15 tabelle business |
| `applyLeadStatusChange` | Tutte le transizioni `lead_status` passano da qui |
| `check-inbox`, `email-imap-proxy`, `mark-imap-seen` | Non modificare senza autorizzazione |
| AuthProvider | Single `onAuthStateChange`, JWT locale, no `getUser()` di rete |
| `operative_prompts` + loader | Modifica via Prompt Lab (DB), no hardcoded |
| `queryKeys.ts` | Centralizzati, niente array inline |
| V2 vs V1 | V2 non importa V1. Tutto `/v1/*` → `/v2/*` |
| Schema/migration | Migration separata, idempotente, reversibile |
| Editorial review | Intoccabile |
| Soft-link partner (`transferred_to_partner_id`) | Mai eliminare record business |

---

## 5. ANTI-PATTERN DA SCANSIONARE PRIMA DI CONSEGNARE

Se uno di questi è vero → **fermo e correggo**:

- [ ] try/catch generico che inghiotte errori (no fallback silenzioso)
- [ ] modifica "già che c'ero" non richiesta → sposta in DEBITO RESIDUO
- [ ] pattern copiato senza capire le precondizioni
- [ ] unica prova è "funziona in locale" / "dovrebbe"
- [ ] refactor mescolato a bug fix (separa)
- [ ] commenti che giustificano codice brutto invece di sistemarlo
- [ ] test scritti dopo per confermare l'esistente
- [ ] formule indeterminate ("dovrebbe", "credo") senza registro
- [ ] chiamata `supabase.from()` fuori da `src/data/`
- [ ] chiamata diretta a edge AI senza `invokeAi()`
- [ ] DELETE fisico su tabella business
- [ ] bypass o duplicazione di `journalistReview`
- [ ] `any` introdotto in TS
- [ ] `.single()` invece di `.maybeSingle()` su query user-specific
- [ ] credenziali / dati sensibili in console.log
- [ ] inline query keys
- [ ] V1 importato in V2

---

## 6. FORMATO OUTPUT MINIMO (STANDARD/CRITICAL)

```
CLASSE: [TRIM | STANDARD | CRITICAL] — [motivo in una frase]
OBIETTIVO: [cosa cambia per l'utente in una frase]

[se CRITICAL]
BLAST RADIUS: [chi consuma il codice modificato]
ASSUNZIONI:
  - [ASSUNTO] ...
ROLLBACK:
  - File toccati: ...
  - Come tornare indietro: ...
  - Effetti irreversibili: [nessuno | elenco + mitigazione]

— modifiche / codice / spiegazione —

CHANGELOG:
  - [VERIFICATO] modifica X in file Y: ...
  - [ATTESO] flusso Z continuerà a funzionare perché ...
  - [ASSUNTO] ipotesi K, reversibile via ...
  Cosa NON toccato (atomicità): ...
  Debito residuo: ...
```

TRIM: solo una riga finale.

---

## 7. REGISTRI OBBLIGATORI

Ogni affermazione di stato in CHANGELOG/output appartiene a uno di:

- `[VERIFICATO]` — l'ho misurato, letto, eseguito, controllato il file.
- `[ATTESO]` — il contratto/sistema dice che funzionerà così, non l'ho eseguito.
- `[ASSUNTO]` — ipotesi esplicita, reversibile, dichiarata.

Frase senza registro = invalida = riformulo o rimuovo.

---

## 8. TRE FRASI VIETATE

Mai dire (mi blocco da solo):

1. ❌ "**dovrebbe funzionare**" → riformulo come `[ATTESO]` con ragione + cosa farei per verificare.
2. ❌ "**ho già fixato**" senza verifica esplicita → riformulo come `[VERIFICATO]: ho letto il file X e applicato la patch Y` oppure `[ATTESO]: la patch è applicata, da verificare in preview`.
3. ❌ "**ne approfitto per…**" → STOP. Atomicità. Sposto l'idea in DEBITO RESIDUO.

---

## 9. REGOLE INVIOLABILI (sopravvivono a tutto)

1. Nessun avanzamento sotto incertezza CRITICA non dichiarata.
2. Nessuna affermazione di stato senza registro.
3. Nessuna pulizia opportunistica. Atomicità sempre.
4. Nessuna credenziale o dato sensibile in codice o log.
5. Nessuna modifica di schema senza piano di migrazione.
6. Nessuna consegna senza changelog veritiero.
7. Nessun fix senza riproduzione o lettura diretta del codice causa.
8. Nessun bypass dei nodi critici §4.

L'utente può chiedere deroga: rispondo *"Questa richiesta confligge con [regola]. Confermi che vuoi proseguire fuori protocollo?"*. Senza conferma esplicita non procedo.

---

*Fine Quick Codex. In dubbio → CRITICAL + STOP + chiedo.*
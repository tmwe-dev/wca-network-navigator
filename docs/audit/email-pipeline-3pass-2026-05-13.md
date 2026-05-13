# Audit Pipeline Email — 3 giri (2026-05-13)

> Audit richiesto a valle del fallimento del Prompt Lab nel riconoscere
> l'identità "Transport Management Srl" e nel rispettare la lingua.
> Tre giri: dati → prompt assembly → comportamento end-to-end.

## TL;DR — i 5 buchi che spiegano "AI non sa chi siamo"

| # | Nodo | Buco | Effetto reale |
|---|---|---|---|
| 1 | `app_settings` | identità TMWE esiste SOLO sotto `user_id = c8aadbed…` | Qualunque altro operatore che lancia generate-email/test produce email senza identità |
| 2 | `prompt-test-runner.loadDoctrineSnippets` | filtro `eq("user_id", userId)` su `kb_entries` | Le 58 entry "system" (`user_id IS NULL`) NON arrivano alla lab → "non vede la KB" anche quando esiste |
| 3 | `operativePromptsLoader` | filtro `eq("user_id", userId)` senza fallback | Operatori senza Prompt Lab personale → zero prompt operativi iniettati nelle email di prod |
| 4 | `generate-email` / `generate-outreach` | `language = payload.language ?? getLanguageHint(country)` | `settings.ai_language = "inglese"` viene IGNORATO se la UI non passa esplicitamente `language` → email in lingua sbagliata (lab e prod divergenti) |
| 5 | `journalistReviewLayer` | nessun riferimento a `language` nel codice | Il revisore obbligatorio NON blocca un output fuori lingua |

---

## Giro 1 — Audit dei dati (snapshot DB)

### app_settings (chiavi `ai_*`)

| user_id | company | contact | role | sig | lang | KB | sig_block |
|---|---|---|---|---|---|---|---|
| **c8aadbed… (TMWE owner)** | ✅ | ✅ | ✅ | ✅ | ✅ inglese | ✅ | ✅ |
| 1d51961d… | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ae35ad39… | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| fe1db58a… | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

→ **L'identità TMWE non è org-wide**. È legata a un singolo `user_id`.
Tutti gli altri operatori autenticati (4 utenti totali con righe `ai_*`)
lavorano senza company/contact/role/signature/language/KB.

### kb_entries (active, non soft-deleted)

| user_id | rows | categorie distinte |
|---|---|---|
| **NULL (system / pool condiviso)** | **58** | doctrine, command_tools, sales_doctrine, system_doctrine, procedures, lab_architect_procedure, prompt_template, tone-and-format |
| ae35ad39… | 109 | agent_doctrine, calligrafia, doctrine, email_management |
| 1d51961d… | 47 | arsenale, chiusura, chris_voss, cold_outreach, dati_partner, doctrine, errori, filosofia, followup, frasi_modello, hook, negoziazione, obiezioni, persuasione, regole_sistema, struttura_email, tono, voice_rules |
| 374e5706… | 2 | email_management |
| 0631506b… | 1 | email_management |
| **c8aadbed… (TMWE owner)** | **0** | — |

→ TMWE owner ha **zero KB proprie** e dipende interamente dalle 58 entry
system. `generate-email/kbAssembler.ts` le carica correttamente con
`or(user_id.eq.X, user_id.is.null)`. **`prompt-test-runner` invece le perde**
(filtro solo `eq("user_id", userId)`).

### operative_prompts (active)

| user_id | totali | OBBLIG. | email | email-quality | outreach | wa+li | general |
|---|---|---|---|---|---|---|---|
| **c8aadbed… (TMWE)** | **29** | 17 | 3 | 4 | 4 | 3 | 5 |
| 1d51961d… | 28 | 19 | 3 | 4 | 4 | 3 | 2 |
| ae35ad39… | 23 | 16 | 2 | 4 | 3 | 2 | 1 |
| fe1db58a… | 22 | 17 | 2 | 4 | 3 | 2 | 1 |
| 27b60e53… | 18 | 14 | 2 | 4 | 2 | 2 | 1 |
| 374e5706… | 16 | 13 | 2 | 4 | 2 | 2 | 1 |

→ Nessun prompt con `user_id IS NULL` (org-wide). Ogni utente ha la sua copia.
Cambi al Prompt Lab non si propagano automaticamente fra operatori.

---

## Giro 2 — Audit dei prompt (assembly statico)

Confronto delle **sezioni del system prompt** per la stessa intent (email)
attraverso i 4 entry-point AI:

| Sezione | generate-email | generate-outreach | improve-email | prompt-test-runner |
|---|---|---|---|---|
| Identità mittente (`ai_company_name` + alias) | ✅ via `senderContext` (`ai_company_alias \|\| ai_company_name`) | ✅ idem | ✅ via `core/email-improver` template | ✅ via `loadSenderIdentity` (16 campi) |
| KB doctrine pool system (`user_id IS NULL`) | ✅ `or(user_id.eq, user_id.is.null)` | ✅ idem | ⚠️ usa `assemblePrompt` lato client + `loadKbContext` (FTS, no user_id filter) | ❌ **filtro `eq(user_id)` → perde le 58 entry system** |
| KB utente | ✅ | ✅ | ✅ | ✅ |
| Operative prompts (Prompt Lab) | ✅ via `loadOperativePromptsBlock` | ✅ via `loadOperativePrompts(scope=outreach\|wa\|li)` | ❌ NON iniettati | ❌ NON iniettati (lab testa solo IL prompt selezionato) |
| Calligrafia (regole formattazione email) | ✅ `buildCalligrafiaSection` | ✅ idem (solo `ch=email`) | ❌ | ❌ |
| Vincolo lingua hard | ⚠️ `language \|\| getLanguageHint(country)` — `ai_language` IGNORATO | ⚠️ idem | ⚠️ delegato al template | ✅ `payload > identity > italiano` |
| Editorial review post-LLM | ✅ `journalistReview` obbligatorio | ✅ via `outreachQueueProcessor` per i canali messaging | ✅ pass-through | ❌ N/A (è un test runner) |
| Editorial review controlla la lingua | ❌ nessuna occorrenza di `language` nel layer | ❌ idem | ❌ idem | — |
| Deep search / enrichment iniettato | ✅ se `deep_search=true` o cache fresca | ✅ idem | ❌ | ❌ |

### Asimmetria prompt-test-runner ↔ generate-email

| Aspetto | prompt-test-runner | generate-email | Conseguenza |
|---|---|---|---|
| KB scope | solo `eq(user_id)` | `or(eq(user_id), is.null)` | Lab "cieca" sulle 58 entry system |
| Operative prompts | non iniettati (testa il singolo prompt) | iniettati come blocco | Test verde ≠ produzione verde |
| Calligrafia | non iniettata | iniettata | Lab valida un output non rappresentativo |
| Lingua | `payload > identity > italiano` | `payload > country > —` (no identity fallback) | Bug di lingua emerge solo in produzione |
| Identità mittente | tutti i 16 campi `ai_*` | sottoinsieme via `senderContext` | OK, allineato |

---

## Giro 3 — Comportamento end-to-end (predizione + test)

I test live via `supabase--curl_edge_functions` non sono eseguibili in
questa sessione: il preview JWT è scaduto/anonimo (`401 invalid_jwt`).
Le previsioni sotto si basano su lettura statica del codice e dati DB; vanno
ri-verificate dalla preview UI loggata come operatore TMWE.

| # | Scenario | Previsione | Causa |
|---|---|---|---|
| T1 | `prompt-test-runner` su prompt `c8aadbed…` (TMWE owner) | ✅ identità presente, ❌ KB system mancante nel system prompt | Bug #2 |
| T2 | `prompt-test-runner` con `payload.language="italiano"` | ✅ override rispettato (codice ok) | — |
| T3 | `generate-outreach` `country_code=DE`, no `language`, operatore TMWE | ⚠️ output in tedesco (country detector vince) anche se `ai_language=inglese` | Bug #4 |
| T4 | `generate-email` partner reale, `quality=premium`, operatore TMWE | ✅ KB sezioni > 0 (via NULL pool), ✅ Prompt Lab applicato, ✅ signature | — |
| T4b | T4 ma operatore NON-TMWE | ❌ identità vuota, ❌ no KB user, ❌ no Prompt Lab specifico | Bug #1 + #3 |
| T5 | `generate-email` partner senza contatto | ✅ 422 `no_contact` | branch già presente nel codice |
| T6 | `generate-outreach` canale `whatsapp` lead cold | ⚠️ dipende dalla presenza del prompt OBBLIGATORIA "WhatsApp Message Gate" per quell'utente | Operatori non-TMWE hanno solo 1-2 prompt scope WA |
| T7 | `generate-outreach` canale `linkedin` | ⚠️ idem; vincolo "≤5 frasi" è in un prompt OBBLIGATORIA per utente | Bug #3 |
| T8 | `improve-email` con superlativi vuoti | ⚠️ Quality Gate è prompt operativo: NON viene iniettato in `improve-email` (manca `loadOperativePrompts`) | Buco aggiuntivo trovato in giro 2 |
| T9 | `generate-email` operatore "vuoto" | ⚠️ produce email firmandosi "(azienda mittente non configurata in Settings)" — vedi `senderCompanyForPrompt` in `promptBuilder.ts` | Bug #1, parzialmente intercettato ma fragile |

---

## Roadmap fix (priorità decrescente)

### P0 — Identità org-wide (sblocca tutti gli operatori)

1. **Schema `app_settings`**: aggiungere meccanismo "org default".
   Soluzione minima: trigger/funzione `get_ai_setting(key)` che fa fallback
   `WHERE user_id = auth.uid() OR user_id = '<org_owner_uuid>'` ordinando per
   priorità del current user. Nessun cambio di chiamanti.
   - In alternativa, replicare le 23 chiavi `ai_*` di `c8aadbed…` su tutti
     gli `user_id` autenticati TMWE (one-shot, finché non c'è `org_settings`).

2. **`prompt-test-runner.loadDoctrineSnippets`**: allineare al pattern
   `or(user_id.eq.${userId},user_id.is.null)` di `kbAssembler.ts`.

3. **`operativePromptsLoader`**: aggiungere fallback `OR user_id IS NULL`
   per consentire prompt org-wide; mantenere precedenza alla riga personale
   se entrambe matchano stesso `name`.

### P1 — Lingua deterministica e verificata

4. In `generate-email/index.ts` e `generate-outreach/index.ts`:
   ```ts
   const effectiveLanguage =
     language ||
     settings.ai_language ||
     getLanguageHint(country_code).language ||
     "italiano";
   ```
   (oggi salta `settings.ai_language`).

5. `journalistReviewLayer`: ricevere `expected_language` in input,
   confrontare con detect dell'output (`franc` o regex hint), restituire
   `verdict: "block"` se difforme.

### P2 — Coerenza lab ↔ produzione

6. `prompt-test-runner` deve iniettare anche calligrafia + operative_prompts
   (almeno i tag `OBBLIGATORIA` universali) per testare lo stesso prompt che
   andrà in produzione.

7. `improve-email`: chiamare `loadOperativePrompts({scope:"email-quality"})`
   per iniettare il "Quality Gate / Verificatore" prima della riscrittura.

### P3 — Diagnostica

8. `_debug` di `generate-email/outreach`: aggiungere
   `identity_loaded: bool`, `kb_user_scope: "self+system"|"self"|"none"`,
   `operative_prompts_user_scope`, `language_source: "payload"|"identity"|"country"|"default"`.

9. Pannello Prompt Lab UI: mostrare per l'utente loggato il "delta TMWE"
   (quante entry/prompt operativi possiede vs owner).

---

## Vincoli rispettati

- Nessun fix applicato in questa sessione: solo audit, come da plan.
- `check-inbox`, `email-imap-proxy`, `mark-imap-seen` non toccati.
- Nessun cambio schema DB: roadmap propone soluzioni, non le implementa.
- Editorial review (`journalistReview`) preservato come INTOCCABILE.

## Prossimo passo proposto

Approvare implementazione **P0+P1** in un solo intervento atomico:

- patch `prompt-test-runner` + `operativePromptsLoader` (fallback NULL),
- ordine lingua corretto in `generate-email` + `generate-outreach`,
- check lingua nel `journalistReview`,
- replica una-tantum delle 23 chiavi `ai_*` TMWE su tutti gli operatori
  autenticati (script SQL idempotente, no schema change).

Stima: ~5 file edge functions + 1 migration dati. Test di regressione su
`prompt_test_cases` esistenti per validare che la lab "veda" KB e identità.
# Piano — Funnemail Prompt Doctrine (regolefunnymail.docx)

## Obiettivo
Trasformare le regole del documento in una **batteria di prompt operativi specializzati** dentro `operative_prompts` (Prompt Lab DB), già letti dal loader esistente (`_shared/operativePromptsLoader.ts`). Niente prompt monolitico: ogni prompt ha `name / context / tags / priority / objective / procedure / criteria / examples`. Il tag `OBBLIGATORIA` vince e viene sempre iniettato.

In parallelo, sblocchiamo la **varietà** dei generatori (temperature/penalty/seed) e attiviamo un **Quality Gate** unico (verdict pass / pass_with_edits / block) prima di ogni invio.

---

## Cosa cambia (atomico, in 4 step reversibili)

### Step 1 — Seed dei 15 prompt nel DB (migration di sola INSERT)
Migration che fa `INSERT … ON CONFLICT (name) DO UPDATE` in `operative_prompts` con i prompt mappati ai context esistenti:

| # | name | context | tags (incl. OBBLIGATORIA) | priority |
|---|---|---|---|---|
| 1 | Anima del messaggio | general | OBBLIGATORIA, universale | 100 |
| 2 | Scrittore commerciale da bestseller | email-quality | OBBLIGATORIA, universale | 100 |
| 3 | Email outbound — precisione, fiducia, risposta | email | email, outreach | 95 |
| 4 | Risposta a email inbound — alto livello | email | email, reply, funnemail | 96 |
| 5 | LinkedIn DM — relazione prima della vendita | linkedin | OBBLIGATORIA, linkedin | 98 |
| 6 | WhatsApp — messaggio operativo breve | whatsapp | OBBLIGATORIA, gate-hard | 98 |
| 7 | Channel router | multi-channel | OBBLIGATORIA, multi-canale | 96 |
| 8 | Outreach strategy & psychology | outreach | OBBLIGATORIA, strategy | 97 |
| 9 | Customer story intelligence | outreach | OBBLIGATORIA, copywriting | 97 |
| 10 | Lead status playbook | lead-status | OBBLIGATORIA | 95 |
| 11 | Post-send doctrine (no doppio invio) | post-send | OBBLIGATORIA | 95 |
| 12 | Funnemail classifier | funnemail_classifier | OBBLIGATORIA, classifier | 100 |
| 13 | Content Intelligence — psicologia & opportunità | content-intelligence | OBBLIGATORIA | 95 |
| 14 | Quality Gate — giudice severo pre-invio | email-quality | OBBLIGATORIA, gate | 99 |
| 15 | No AI smell | email-quality | output-format, copywriting | 80 |

Body di ogni prompt copia testualmente Objective/Procedure/Criteria/Examples dal documento. Nessun codice TS toccato in questo step → totalmente reversibile (basta cancellare i record).

### Step 2 — Sblocco varietà nei generatori (patch minime, 1 file ciascuno)
- `supabase/functions/generate-email/index.ts`: aggiungo `temperature: 0.75`, `presence_penalty: 0.3`, `frequency_penalty: 0.4`, `seed` random.
- `supabase/functions/generate-outreach/index.ts`: stessi parametri.
- `supabase/functions/improve-email/index.ts`: alzo `temperature` da 0.4 → 0.6 + `frequency_penalty: 0.3`.
- Iniezione "anti-duplicato": ultime N email outbound stesso `email_type` + `language` come blocco `## Evita di ripetere queste aperture/chiusure`.

Nessuna modifica ai system prompt TS (rispetta AI Prompt Freedom Doctrine: tono/regole vivono nel DB).

### Step 3 — Quality Gate cablato a `journalistReview`
`journalistReview` carica il prompt **#14 Quality Gate** via loader (scope `email-quality`, tag `gate`, OBBLIGATORIA) e ritorna verdict standardizzato:
- `pass` → invia originale
- `pass_with_edits` → invia `edited_text`
- `block` → fail con motivo (gate hard, già esistente)

Effetto: tutti i 4 send (`send-email`, `send-whatsapp`, `send-linkedin`, `process-email-queue`) ereditano automaticamente le nuove regole, senza toccarli.

### Step 4 — UI Prompt Lab: filtro "OBBLIGATORIA" + badge gate-hard
Su `/v2/prompt-lab` (pagina già esistente):
- Aggiungo chip filtro per tag (`OBBLIGATORIA`, `gate-hard`, `funnemail`, `outreach`, ecc.).
- Badge visivo "OBBLIGATORIA" e "gate-hard" sulle righe corrispondenti.
- Nessuna modifica al data flow (legge già `listPromptCatalog`).

---

## Detail tecnico

- **Loader esistente** (`_shared/operativePromptsLoader.ts`): filtro deterministico per `context` + `tag`, OBBLIGATORIA prioritario. Già adottato da `generate-email`, `generate-outreach`, `improve-email`, `classify-email-response`, `agent-loop`, `agent-execute`, `ai-assistant` → l'iniezione dei 15 nuovi prompt è automatica appena entrano in DB.
- **Quality Gate**: lo schema di output (`{verdict, edited_text?, reason?}`) è già il contratto attuale di `journalistReview` → solo il prompt cambia, non il caller.
- **Versioning**: ogni INSERT crea snapshot in `prompt_versions` via trigger esistente → rollback a 1 click.
- **Test regression**: aggiungo test cases in `prompt_test_cases` per i 4 prompt OBBLIGATORIA core (Anima, LinkedIn, WhatsApp, Quality Gate) per garantire stabilità nei prossimi cambi.

---

## Cosa NON tocco
- `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo memoria).
- `funnemail-send-autoresponder` (eccezione template-only).
- System prompt TS dei generatori (restano minimali per AI Prompt Freedom).
- RLS, schema tabelle business, soft-delete, hard guards.

---

## Output finale
- 15 record in `operative_prompts` (snapshot in `prompt_versions`).
- 3 edge function patchate (varietà sbloccata).
- Quality Gate operativo su tutti i canali.
- UI Prompt Lab con filtri tag e badge.
- Memoria già aggiornata: `mem://standards/funnemail-prompt-doctrine`.

Procedo step 1→4 in commit separati e reversibili. Posso partire?

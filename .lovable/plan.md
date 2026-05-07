## Obiettivo

Dare a TMWE una **voce unica e misurabile** in tutti i contenuti generati (email, WhatsApp, LinkedIn, voce), eliminando duplicazioni nei prompt e introducendo metriche di aderenza allo stile.

## Strategia

Quattro layer cooperanti, già presenti come scheletro nel sistema:

```text
KB (doctrine/brand-voice)  ← fonte unica della "voce TMWE"
        │
        ├─► agent_personas (45 agenti + 4 ruoli editoriali)
        │
        ├─► operative_prompts ("Stile TMWE" master + varianti canale)
        │
        └─► journalistReviewLayer (score aderenza + telemetria)
```

Tutto editabile da DB → nessun redeploy per cambiare tono.

---

## Fase 1 — Brand Voice canonico in KB

Creare 8 schede `kb_entries` nella `family = "doctrine"`, capitolo `brand-voice`, tutte con `canonical_id` univoco e tag standardizzati:

1. `brand-voice/identity` — chi siamo, valori, posizionamento
2. `brand-voice/tone-base` — tono madre (professionale-caldo, diretto, mai servile)
3. `brand-voice/lexicon-do` — parole/frasi da preferire (per IT, EN, ES, FR, DE)
4. `brand-voice/lexicon-dont` — parole/frasi vietate + motivazione
5. `brand-voice/punctuation-emoji` — regole su `!`, `…`, emoji per canale
6. `brand-voice/signatures` — signature standard per canale e per ruolo
7. `brand-voice/length-rules` — lunghezze consigliate (email 80-150 parole, WA ≤ 60, LI ≤ 300 char, voce ≤ 25s)
8. `brand-voice/channel-deltas` — differenze formalità/saluti/frequenza per email vs WA vs LI vs voce

Inserite via `kb_entry_proposals` (1-click approval in KB Supervisor, coerente con governance esistente).

## Fase 2 — Popolare `agent_personas`

**4 ruoli editoriali** (Rompighiaccio, Risvegliatore, Chiusore, Accompagnatore) → 4 righe in `agent_personas` con `agent_id` dedicato:

- `tone`, `custom_tone_prompt`
- `vocabulary_do[]`, `vocabulary_dont[]`
- `style_rules[]` (max 5)
- `example_messages` (JSONB: 3 esempi corretti + 3 vietati per IT/EN)
- `signature_template`

**45 agenti applicativi**: persona di default minimale (eredita brand voice + tono base), override solo per agenti che lo richiedono (es. LUCA, Sherlock).

Seed via `kb_entry_proposals` parallelo: una proposta per ruolo, una bulk per gli agenti.

## Fase 3 — Consolidamento prompt

In `operative_prompts`:

- **NUOVO** `stile-tmwe-master` (context `general`, tag `[brand-voice, master]`, priority 100): unico prompt che riferisce la KB `doctrine/brand-voice/*` e applica la persona dell'agente chiamante.
- **4 varianti canale** snelle (`stile-email`, `stile-whatsapp`, `stile-linkedin`, `stile-voce`) che ereditano dal master e aggiungono solo i delta canale.
- **Deprecare** (soft, `is_active=false`) i 6 prompt outreach duplicati + i frammenti di tono ripetuti negli scope email/whatsapp/multi-channel. Lista esatta in fase di esecuzione dopo audit `findOperativePromptsFull`.
- Anti-ripetizione, zero-allucinazioni, plan→approve→execute, holding-pattern restano **moduli separati e intoccati**.

`_shared/operativePromptsLoader.ts` carica già per context+tag → nessuna modifica al loader.

## Fase 4 — Brand Voice Score nel Journalist Review

Estendere `_shared/journalistReviewLayer.ts` (intoccabile per logica di gating, ma estendibile per metriche):

- Aggiungere campo `brand_voice_score` (0-100) all'output, calcolato con rubrica deterministica (presenza signature, lunghezza nei range, lessico do/don't, emoji policy) + fallback LLM-judge solo se mancano segnali.
- Soglie: <60 = warning in `JournalistReviewOutput.warnings`, <40 = `pass_with_edits` forzato.
- Telemetria in nuova tabella `brand_voice_audits` (message_id, channel, agent_id, score, deviations[], created_at).

Nessun gate bloccante nuovo → niente regressioni sul flusso di invio.

## Fase 5 — Esempi e template

- Arricchire `funnemail_autoresponder_templates` e `email_templates` con `voice_example_for` pointer al `canonical_id` brand-voice.
- Per ogni `agent_personas.example_messages`: 3 corretti + 3 vietati per lingua principale dell'agente.

## Fase 6 — KPI dashboard

Nuova vista `/v2/settings/brand-voice` (UI sola, hook esistenti):
- Distribuzione `brand_voice_score` per canale e per ruolo (ultimi 30gg)
- Top 10 deviazioni ricorrenti
- Tasso risposta correlato allo score (join con `outreach_messages` esistente)

Nessuna nuova business logic: solo lettura da `brand_voice_audits` + DAL esistenti.

---

## Sequenza esecuzione consigliata

1. Fase 1 (KB brand-voice) → proposte pending, utente approva 1-click
2. Fase 2 (personas 4 ruoli) → idem
3. Fase 3 (prompt master + varianti) → audit + soft-deprecate duplicati
4. Fase 4 (score nel review) → migrazione tabella + estensione layer
5. Fase 5 (esempi/template) → seed
6. Fase 6 (dashboard KPI) → UI

Ogni fase è reversibile (soft-delete + soft-deprecate, no DROP, no breaking change al journalist gate).

## Note tecniche

- **Niente modifiche** a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `loadOptimusSettings` (kill-switch resta `enabled:true`).
- Nuova tabella `brand_voice_audits` con RLS (operatore vede tutto, in coerenza con visibilità globale agenti).
- `canonical_id` su tutte le 8 schede KB per evitare duplicati futuri.
- Test di regressione: estendere `src/test/journalist-pipeline-coverage.test.ts` con 3 nuovi test (score calcolato, warning sotto soglia, no gate bloccante).
- Memoria nuova: `mem://features/brand-voice-system` con mappa dei 4 layer.

## Domande aperte (rispondibili in implementazione)

- Vuoi che il Brand Voice Score sia **visibile in UI** durante la composizione (badge live) o solo in audit retroattivo?
- I 4 ruoli editoriali devono avere **personalità nominali** (es. "Marco il Rompighiaccio") o restare ruoli astratti?

Le risposte non bloccano la Fase 1-3, solo le rifiniture di UI.

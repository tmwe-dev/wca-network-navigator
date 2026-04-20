

## Mappa attuale del Composer email — cosa fa veramente cosa

### 1. ORACOLO (pannello laterale `OraclePanel`)
È solo un **pannello di configurazione** — non chiama AI da solo. Raccoglie 5 input:

| Campo | Cosa fa | Dove finisce |
|---|---|---|
| **Textarea "Descrivi obiettivo"** (`customGoal`) | Istruzione libera dell'utente, con dettatura vocale | Concatenato come `ISTRUZIONI SPECIFICHE DELL'UTENTE` dopo il prompt del tipo |
| **Chip Tipo email** (`primo_contatto`, `follow_up`, `richiesta_info`, `proposta`, `partnership`, `network_espresso` + custom) | Inietta un **prompt strutturato** con hook/CTA/vincoli specifici per quel tipo | `effectiveGoal` + `oracle_type` (id) |
| **Tono** (formale/professionale/amichevole/diretto) | Modula stile | `oracle_tone` |
| **KB toggle** 📖 | Attiva/disattiva injection della Knowledge Base | `use_kb` |
| **Deep Search toggle** 🔍 | **⚠️ ATTUALMENTE NON FA NULLA**: il flag viene inviato all'edge ma `generate-email` lo ignora. Si limita a leggere `enrichment_data.deep_search_summary` se già esiste in cache | `deep_search` (flag morto) |

I tasti **Genera** e **Migliora** chiamano poi due flussi distinti.

---

### 2. GENERA (`Sparkles`) → edge `generate-email` (~700 righe di logica)

Pipeline (`useEmailComposerState.handleAIGenerate` → `generate-content?action=email`):

```text
[OracleConfig] + [Mission goal/baseProposal] + [Recipient (1 o N)]
        │
        ▼
loadStandalonePartner / loadEntityFromActivity   ◄── carica partner+contatto reali da DB
        │
        ▼
assembleContextBlocks                            ◄── 13 blocchi paralleli (vedi sotto)
        │
        ▼
buildEmailPrompts                                ◄── compone systemPrompt + userPrompt
        │
        ▼
aiChat (gemini-3-flash-preview, fallback flash/gpt-5-mini)
        │
        ▼
parseEmailResponse → { subject, body }
```

I **13 blocchi di contesto** assemblati (in parallelo):
1. **Partner** — nome, alias, città, paese, sito, rating, descrizione, profilo markdown
2. **Networks** — appartenenze WCA
3. **Services** — categorie servizio
4. **Social links** (LinkedIn) — solo quality=premium
5. **Settings mittente** — alias, azienda, ruolo, firma, KB aziendale
6. **Sales KB strategica** (`fetchKbEntriesStrategic`) — pesca da `kb_entries` filtrando per `kb_categories` del tipo email scelto + categorie standard (`regole_sistema`, `filosofia`, `struttura_email`, `hook`, `cold_outreach`); aggiunge `followup`/`chris_voss`/`obiezioni` se follow-up; `negoziazione`/`tono`/`frasi_modello` se ≥standard; `arsenale`/`persuasione`/`chiusura` se premium
7. **Style preferences** — pescate da `ai_memory` (apprese dagli edit dell'utente)
8. **Edit patterns** — pattern di editing storici per lo stesso `email_type` + paese
9. **Response insights** — % risposta storica per quel canale/paese/tipo
10. **Conversation Intelligence** — `contact_conversation_context`, `email_address_rules`, ultime classificazioni
11. **Met in person** — incontri BCA registrati
12. **Cached enrichment** — `website_summary`, `linkedin_summary`, `deep_search_summary` (solo se già in cache)
13. **Documents** — testi estratti da workspace docs
14. **Same-Location Guard + Branch coordination**
15. **Commercial state** — fase, touch_count, warmth_score, days_since_last_contact, ultimo canale/esito → genera `toneInstruction` dinamica
16. **Active Playbook** — `commercial_playbooks` + `commercial_workflows` per il partner (priorità su KB)
17. **Strategic Advisor** — meta-blocco che dice all'AI: tipo, storia, follow-up #N, tono per fase

### 3. MIGLIORA (`Wand2`) → edge `improve-email`

Più semplice. Riceve solo: subject, html_body, oracle_tone, use_kb, recipient_count/countries.

⚠️ **GAP grossi**: 
- **Non riceve** `email_type_id`, `email_type_prompt`, `email_type_structure` dal composer (anche se la edge function li accetta!) → migliora "alla cieca" senza sapere se è un primo contatto o un follow-up
- **Non riceve** descrizione/customGoal dell'utente
- **Non riceve** info partner/contatto/history → migliora solo lo stile, ignora il contesto commerciale
- Usa `decision.improvement_focus` hardcoded che dipende da `email_type_id` mai passato

---

## I 4 problemi che hai identificato

### Problema A — Deep Search è un placebo
Il toggle 🔍 nell'Oracolo invia `deep_search: true` ma `generate-email/index.ts` non lo legge. La generazione usa solo `enrichment_data.deep_search_summary` se esiste già in DB. Se il partner non è mai stato arricchito, il toggle **non fa nulla**.

### Problema B — Migliora vola cieca
`improve-email` ignora tipo email, descrizione utente, contatto, partner, history. Migliora solo grammatica/stile generico. Il rischio è che un follow-up venga "migliorato" come se fosse un primo contatto.

### Problema C — Tipo contatto vs descrizione: nessuna sinergia
- Il prompt del **Tipo** (`primo_contatto`/`follow_up`/...) è hardcoded in `defaultEmailTypes.ts`
- La **descrizione** dell'utente viene appiccicata DOPO con `\n\nISTRUZIONI SPECIFICHE DELL'UTENTE:\n`
- Ma se l'utente scrive "follow-up dopo fiera Monaco" e seleziona tipo "Primo contatto", **non c'è coerenza** — il prompt impone "MAI ripetere presentazione" e la descrizione confligge
- Manca un **detector** che concili i due input o avvisi l'utente

### Problema D — Memoria/History/Profilo sono caricati ma non visibili
`generate-email` carica history, edit patterns, conversation intelligence, met-in-person, BCA, playbook commerciale. Tutto questo è **invisibile** all'utente che genera. Non sa cosa l'AI ha "in mano" → non capisce perché un'email viene così. Manca un **debug pannello** "Cosa ha visto Oracolo".

---

## Piano di intervento

### Fase 1 — Riparare Deep Search (rendere reale il toggle)
- Quando `deep_search=true` e il partner ha `partner_id` reale, prima di generare:
  - Controllare se `enrichment_data.deep_search_at` < 30 giorni → usa cache
  - Altrimenti chiamare edge `enrich-partner` (deep search) **inline e attendere** prima della generazione
  - Se sito/LinkedIn non scrapati, eseguirli
- Mostrare nello stato "Deep Search in corso..." prima di "Generazione..."
- Se il partner è generico (no partner_id), il toggle resta off automaticamente con tooltip "richiede partner CRM"

### Fase 2 — Migliora context-aware
Allineare il payload di `improve-email` a quello di `generate-email`:
- Aggiungere `email_type_id`, `email_type_prompt`, `email_type_structure`, `customGoal`, `partner_id`, `contact_id`
- Caricare lato edge gli stessi blocchi essenziali: history, conversation intelligence, commercial state, edit patterns
- `improvement_focus` calcolato dinamicamente in base a tipo + touch_count
- Se `touch_count > 0` ma il body sembra primo contatto → suggerire correzione prima di migliorare

### Fase 3 — Sincronia Tipo + Descrizione
Nel `OraclePanel`:
- Quando l'utente seleziona un tipo, **suggerire** un placeholder nella textarea ("es. Riprendere conversazione del 15 marzo dopo fiera Monaco" per follow-up)
- Aggiungere **chip-warning** se descrizione contiene parole-chiave incoerenti col tipo (es. "follow-up", "ricordare", "abbiamo parlato" su tipo `primo_contatto`)
- Lato backend: il prompt builder dà priorità alla descrizione utente quando dichiara esplicitamente fase commerciale ("STAI scrivendo un follow-up: seguire le regole follow-up anche se tipo selezionato è X")

### Fase 4 — Pannello "Cosa sa Oracolo" (trasparenza contesto)
Sotto i bottoni Genera/Migliora aggiungere accordion **"Contesto attivo"** che mostra:
- 📚 KB sezioni caricate: `regole_sistema, hook, cold_outreach, follow_up`
- 📊 Storia: 3 email inviate, ultima 12gg fa, ultimo esito: no_reply
- 🌡️ Calore relazione: 35/100 (FOLLOW-UP INIZIALE)
- 🔍 Deep Search: cached 5gg fa (oppure "non disponibile, attiva toggle")
- 📇 Met in person: BCA fiera Monaco 2025
- 🎯 Playbook attivo: "Recupero lead freddo" (workflow sales_standard, step 3)
- ⚙️ Settings mittente OK / mancanti

Fonte dati: edge `generate-email` deve restituire un campo `_context_summary` con questi metadati (già caricati internamente, basta esporli).

### Fase 5 — Profile snapshot inline
Header del Composer: chip riassuntivo del destinatario (1 contatto) con:
- Nome+azienda+paese+città
- Tag: 🌡️ Cold/Warm/Hot, 📊 N touch, ⏱️ Xgg ultimo contatto
- Click → apre drawer profilo in side-panel senza lasciare il Composer

---

## Output di questa analisi

Lo schema completo Tipo → Prompt → KB → Context → Output è documentato sopra. Le 5 fasi sono indipendenti e si possono attivare singolarmente.

## Domande per te

1. **Deep Search**: vuoi che il toggle scateni un vero scrape live (sito + LinkedIn) bloccando la generazione 5-15s, oppure async con notifica "Deep search in corso, genero comunque con dati attuali"?
2. **Improve cieco**: confermi che `improve-email` deve diventare context-aware come `generate-email` (passa partner/contact/history)?
3. **Pannello Contesto**: lo vuoi sempre visibile (accordion chiuso di default) o solo dietro un'icona ℹ️?
4. **Coerenza Tipo+Descrizione**: warning client-side soft (chip giallo) o blocco hard con conferma?


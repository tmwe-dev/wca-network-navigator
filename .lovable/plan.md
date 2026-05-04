
# Funnemail Inbox — il client di posta che decide tutto via prompt

## Filosofia

Niente più liste di gruppi cablate nel codice, niente filtri JS in agenda, niente regex sui titoli. Tutto il comportamento è governato da:

1. Un **prompt operativo** in `operative_prompts` (editabile dal Prompt Lab senza redeploy).
2. Una **KB** in `knowledge_base` con le definizioni delle cartelle operative.
3. Due **cervelli paralleli** che leggono la stessa email e producono due decisioni indipendenti.

Il codice fa solo da postino: chiama l'AI, legge la sua decisione, la mostra.

---

## I due cervelli paralleli

```text
                Email inbound
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  Funnemail (operativo)     LeadProcessManager (commerciale)
  - Cartella                 - Stato lead
  - Azione consigliata       - Circuito di attesa
  - Va in agenda? S/N        - Owner commerciale
  - Bozza necessaria? S/N    - Pipeline Kanban
        │                         │
        └─────────┬───────────────┘
                  ▼
         funnemail_decisions (una riga per email)
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
 Inbox UI     Agenda      Outreach pipeline
```

I due sistemi non si sovrappongono. Funnemail decide *dove vive la mail nell'inbox e cosa farne operativamente*. Il sistema commerciale decide *se merita seguito di vendita*. Entrambi loggano la loro decisione sulla stessa riga `funnemail_decisions` per audit.

---

## Cosa costruisco

### 1. Pagina nuova `/v2/funnemail-inbox`

Layout a tre colonne, copia visiva di un mail client classico, ma le "cartelle" sono **classificazioni operative**, non gruppi mittente.

```text
┌──────────────────┬──────────────────────────┬───────────────────────┐
│ SIDEBAR          │ LISTA MAIL               │ LETTURA + AZIONI      │
│                  │ (cartella selezionata)   │                       │
│ ▸ Operative      │                          │ Oggetto               │
│   - Offerte/RFQ  │ ┌──────────────────────┐ │ Da: ...               │
│   - Operations   │ │ ⚡ Urgente           │ │ ─────                 │
│   - Tasks/Pratich│ │ Oggetto              │ │ [corpo pulito]        │
│   - Supporto     │ │ Mittente · 2h        │ │                       │
│   - Chat interna │ │ [badge azione]       │ │ ─── Funnemail ───     │
│   - Urgenze/Alert│ └──────────────────────┘ │ Cartella: RFQ         │
│   - Informazioni │ ┌──────────────────────┐ │ Azione: bozza         │
│ ▸ Archivio       │ │ ...                  │ │ Confidenza: 92%       │
│   - Newsletter   │ └──────────────────────┘ │ Perché: [reasoning]   │
│   - NO_REPLY     │                          │ [Apri bozza] [Override│
│   - ADS          │                          │                       │
│ ▸ Da smistare    │                          │ ─── Commerciale ───   │
│ ▸ Tutte          │                          │ Lead: in attesa       │
└──────────────────┴──────────────────────────┴───────────────────────┘
```

Cartelle operative iniziali (tutte editabili da DB, nessuna hardcoded):

- **Offerte / Richieste quotazione**
- **Servizi operations**
- **Informazioni**
- **Tasks / Pratiche**
- **Richieste di supporto**
- **Chat / Messaggi interni** (colleghi & partner)
- **Urgenze / Alert**
- **Altro urgente**

Sotto, sezione "Archivio" con le cartelle automatiche (Newsletter, NO_REPLY, ADS, ecc.) — sempre presenti ma collassate per default. La mail ci finisce quando Funnemail dice "non richiede azione".

### 2. Tabella `funnemail_folders` (le cartelle, editabili)

Una tabella DB con: nome, slug, descrizione operativa, icona, ordine, sezione (operative/archivio), `accept_into_agenda` (bool), prompt-hint per il classificatore. **Nessuna lista nel codice.** L'admin può aggiungere/togliere cartelle dalla UI.

### 3. Tabella `funnemail_decisions` (la decisione per ogni email)

Una riga per `(message_id)`: `folder_slug`, `suggested_action` (none/draft_reply/forward/escalate/archive), `goes_to_agenda` (bool), `urgency`, `reasoning` (testo AI), `confidence`, `commercial_handoff` (bool, se il cervello commerciale deve prendere in carico).

### 4. Prompt operativo `funnemail_classifier`

Nuovo prompt in `operative_prompts` con `context = 'funnemail_classifier'`, scritto secondo lo standard Professore (Identità/Obiettivo/Metodo/Guardrail/Output). Riceve in input:
- testo email pulito (via `contentNormalizer`)
- mittente + dominio + gruppo già noto
- elenco cartelle disponibili (caricato da `funnemail_folders`)
- storico ultime N interazioni con quel mittente

Restituisce JSON validato (Zod):
```json
{
  "folder_slug": "rfq",
  "suggested_action": "draft_reply",
  "goes_to_agenda": true,
  "urgency": "high",
  "confidence": 0.92,
  "reasoning": "Cliente conosciuto chiede preventivo per spedizione MXP→JFK, deadline venerdì.",
  "commercial_handoff": true
}
```

Il prompt è la **sola sede della logica**. Cambi cartelle, soglie, criteri "rumore" → modifichi il prompt nel Prompt Lab. Niente deploy.

### 5. Cambio minimo a `classify-inbound-message`

Dopo la classificazione AI esistente, **prima** di creare l'attività `follow_up`, chiama il nuovo classificatore Funnemail. Se `goes_to_agenda = false`, non crea l'attività di follow_up. Se `commercial_handoff = true`, passa l'evento al `LeadProcessManager` come fa già oggi.

Modifica chirurgica, una sola decisione delegata al prompt: "questa mail va in agenda?". Nessuna lista nel codice.

### 6. Agenda — zero modifiche di filtraggio

L'agenda continua a mostrare quello che ha. Le 19 attività di oggi restano. Da domani, semplicemente non se ne creano più di nuove per le mail che il prompt Funnemail classifica come "non richiedono risposta umana". Pulizia naturale per attrito.

### 7. Voce di sidebar

Aggiungo "Funnemail Inbox" nella sidebar V2 sopra la attuale "Email Intelligence". La pagina `/v2/email-intelligence` resta com'è (è il pannello di configurazione, non il client).

---

## Dettagli tecnici

**File nuovi:**
- `src/v2/ui/pages/FunnemailInboxPage.tsx` — pagina, solo UI
- `src/v2/hooks/useFunnemailInbox.ts` — stato, query keys
- `src/v2/ui/pages/funnemail-inbox/FoldersSidebar.tsx`
- `src/v2/ui/pages/funnemail-inbox/MailList.tsx`
- `src/v2/ui/pages/funnemail-inbox/MailReader.tsx`
- `src/v2/ui/pages/funnemail-inbox/FunnemailDecisionPanel.tsx`
- `src/v2/ui/pages/funnemail-inbox/CommercialPanel.tsx`
- `src/data/funnemailInbox.ts` — DAL letture (folders, mails per folder, decisions)
- `supabase/functions/funnemail-classify/index.ts` — chiama AI, valida JSON con Zod, scrive `funnemail_decisions`

**File toccati (chirurgia):**
- `supabase/functions/classify-inbound-message/index.ts` — chiama `funnemail-classify` e usa `goes_to_agenda` per decidere se creare l'attività `follow_up`
- `src/v2/ui/AppSidebar.tsx` (o equivalente) — voce nuova
- `src/lib/queryKeys.ts` — chiavi `funnemail.inbox.*`
- `src/v2/ui/pages/PromptLabPage.tsx` — assicuro che `funnemail_classifier` sia listato (auto, già lo fa)

**Migrazione DB:**
- `funnemail_folders` (slug univoco, prompt_hint, accept_into_agenda, sort_order, sezione)
- `funnemail_decisions` (message_id PK, folder_slug FK, suggested_action, goes_to_agenda, urgency, reasoning, confidence, commercial_handoff)
- Seed iniziale con le 8 cartelle operative + 5 di archivio (Newsletter/NO_REPLY/ADS/Spam/Other)
- Seed prompt `funnemail_classifier` in `operative_prompts`
- RLS: lettura authenticated, write solo admin
- Edge metrics: log `funnemail.classify.*`

**Cosa NON tocco:**
- `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo memoria)
- Funnemail dispatcher esistente (resta per le policy gruppo)
- `journalistReview`
- Codice agenda (nessun filtro JS, nessun cleanup retroattivo)
- Email Intelligence page attuale

---

## Cosa cambia per te in pratica

- Nuova voce sidebar "Funnemail Inbox": apri e vedi le mail nelle cartelle giuste.
- Newsletter, no-reply, ADS finiscono in "Archivio" senza creare attività in agenda.
- Le RFQ vere finiscono in "Offerte / RFQ" con badge "bozza pronta" e passano al cervello commerciale.
- Il prompt che decide tutto questo lo modifichi tu nel Prompt Lab → effetto immediato, zero deploy.
- Le 19 attività vecchie le smaltisci a mano. Da domani non se ne formano più di rumore.


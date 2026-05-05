## Obiettivo

Aggiungere un livello di **lettura del contenuto** sopra alla classificazione mittente già esistente. L'AI deve capire **cosa dice davvero la mail** e decidere — con contesto pieno e leggerezza — dove veicolarla (commerciale / operativo / amministrativo), con quale urgenza, e con quale azione preparata. Tutto resta deciso da un umano: l'AI propone, l'operatore conferma.

Nessuna lista chiusa di categorie nel codice. Le categorie le sceglie l'AI dal contesto, guidata da prompt + KB editabili.

---

## Architettura proposta (3 strati)

```text
┌─ Strato 1: SMISTAMENTO (già esiste) ────────────────────────┐
│ email_sender_groups → cartelle Funnemail (urgenza visiva)   │
│ Non cambia. Resta il "primo cestino" dove guardi.           │
└──────────────────────────────────────────────────────────────┘
                          │
┌─ Strato 2: COMPRENSIONE CONTENUTO (nuovo) ──────────────────┐
│ Edge: classify-inbound-content                              │
│ Input: corpo mail + CONTESTO COMPLETO                       │
│ Output: { intent, business_value, urgency, target_role,     │
│           continuity, reasoning, suggested_actions[] }      │
│ Tutto AI-driven, niente enum hardcoded.                     │
└──────────────────────────────────────────────────────────────┘
                          │
┌─ Strato 3: DISPATCH (nuovo, governato) ─────────────────────┐
│ Per ogni suggested_action → propone (mai esegue da sola):   │
│  • Badge in inbox (categoria + urgenza)                     │
│  • Riga agenda con priorità calcolata                       │
│  • Escalation lead_status (se collegata a campagna)         │
│  • Bozza risposta pre-compilata                             │
│ Tutte le azioni atterrano in ai_pending_actions             │
│ (two-phase commit, già attivo dal Risk Gate v2.1).          │
└──────────────────────────────────────────────────────────────┘
```

---

## Strato 2 — Cosa inietta l'AI nel contesto

Il punto critico. L'AI deve avere **il passaporto e la storia** del mittente, non solo il testo:

1. **Profilo mittente** — partner row: chi è, cosa fa, paese, role nel network, BCA badges.
2. **Storia commerciale** — ultime 30 interazioni (email + WA + LI) cross-channel.
3. **Holding pattern** — è in circuito di attesa? campagna attiva? quale step? da quando?
4. **Memoria L1/L2/L3** — fatti salienti già appresi su questo contatto.
5. **Profilo nostro** — `system_doctrine` (cosa facciamo, cosa è critico per noi).
6. **KB tematica** — cards rilevanti (es. "quote-response", "complaint-management").
7. **Deep Search on-arrival** — se il mittente non ha mai avuto deep search → trigger automatico Scout level (rapido) PRIMA della classificazione, così la prima mail di uno sconosciuto è già letta con contesto.
8. **Ultime mail del thread** — già normalizzate dal `contentNormalizer`.

Tutto passa dal `promptSanitizer` + `injectionGuard` esistenti.

---

## Strato 3 — Output e azioni proposte

L'AI restituisce JSON aperto, validato da Zod ma **senza enum chiuso** sui campi semantici:

```json
{
  "content_label": "Richiesta quotazione motore Australia",
  "intent_summary": "Cliente abituale chiede quotazione spedizione motore industriale IT→AU via mare",
  "business_value": "high|medium|low|none",
  "urgency": "critical|high|normal|low",
  "target_role": "commercial|operational|administrative|none",
  "continuity": { "campaign_id": "uuid|null", "thread_with_partner": true },
  "reasoning": "1-2 frasi max",
  "suggested_actions": [
    { "type": "badge", "label": "Quotazione 🔥", "color": "..." },
    { "type": "agenda", "title": "Quotare motore AU per ACME", "due_in_hours": 4, "assignee_role": "commercial" },
    { "type": "lead_status", "next": "qualified", "reason": "buying signal esplicito" },
    { "type": "draft_reply", "template_hint": "quote_request_logistics" }
  ]
}
```

Ogni `suggested_action` diventa una riga in `ai_pending_actions` con risk gate. L'operatore approva dall'agenda o dall'inbox.

---

## Cosa cambia in DB

- **Nuova tabella `email_content_intelligence`** — una riga per ogni mail letta dal nuovo classificatore. Campi: `email_id`, `content_label`, `intent_summary`, `business_value`, `urgency`, `target_role`, `continuity`, `reasoning`, `confidence`, `model`, `created_at`. Append-only, RLS per user_id.
- **Riusa `ai_pending_actions`** — nessun nuovo binario di esecuzione.
- **Nessun nuovo enum chiuso.** Le label vivono come stringhe, l'AI le sceglie. Filtri inbox sono dinamici sui valori distinti osservati.

---

## Cosa cambia in edge functions

- **Nuova `classify-inbound-content`** — orchestratore <200 LOC che:
  1. Carica contesto (profilo + history + holding + memoria + KB).
  2. Se mittente senza deep search → trigger `sherlock-investigator` level Scout (await rapido o async con re-classify).
  3. Carica prompt operativo `content_intelligence` da `operative_prompts` (editabile da Prompt Lab).
  4. Chiama AI via `invokeAi()` con scope `classify-content`.
  5. Valida JSON con `safeParseAiJson`.
  6. Insert in `email_content_intelligence` + crea `ai_pending_actions`.
  7. Log strutturato + `ai_interaction_log`.
- **`check-inbox` non cambia.** Resta intoccabile come da memoria. Trigger del nuovo classifier via cron o webhook su `email_inbound` insert.
- **`classify-email-response` esistente resta** per il binario lead_status legacy. Dopo 2-3 settimane di dual-run si valuta migrazione.

---

## Cosa cambia in UI

1. **Funnemail Inbox** — accanto al badge gruppo mittente, secondo badge "content" con label + urgenza (colore).
2. **Filtro vista** — aggiunta tab "Da gestire ora" (urgency ∈ critical/high) e filtro per `target_role`.
3. **Pannello lettura mail** — nuova sezione "Cosa propone l'AI": elenco `suggested_actions` con bottone Approva / Modifica / Scarta per ognuna.
4. **Agenda** — le righe create da questo flusso hanno tag origine "📧 inbound" e linkano alla mail.
5. **Prompt Lab** — il prompt `content_intelligence` è editabile come gli altri (versionato + test di regressione già attivi).

---

## Governance

- Tutto passa da `invokeAi()` con scope registrato (charter rispettato).
- Risk gate: tutte le azioni proposte sono `risk = medium` o superiore → richiedono approvazione umana di default. Solo "badge" è auto-applicato.
- Editorial review (`journalistReview`) obbligatorio sulle bozze risposta generate.
- Prompt versionato + test di regressione su corpus di mail reali anonimizzate.

---

## Roll-out (3 step incrementali, reversibili)

**Step 1 — Lettura passiva (1-2 giorni)**
Crea tabella + edge function + prompt. Classifica tutte le inbound nuove. Nessuna azione automatica. Solo mostra il badge in inbox + sezione "Cosa direbbe l'AI" nel pannello lettura. Serve a calibrare il prompt sui dati veri.

**Step 2 — Azioni proposte (2-3 giorni)**
Attiva `suggested_actions` → `ai_pending_actions`. Operatore vede la coda di proposte e approva. Niente auto-esecuzione tranne badge.

**Step 3 — Auto-pilota mirato (dopo conferma utente)**
Per categorie ad alta confidence (>0.85) e basso rischio, attivazione auto di: inserimento agenda + bozza risposta. Lead status escalation resta sempre con approvazione esplicita.

---

## Note tecniche (per il team dev)

- Ri-uso `_shared/operativePromptsLoader.ts` con context `content-intelligence`.
- Ri-uso `_shared/contentNormalizer.ts` + `_shared/promptSanitizer.ts` + `_shared/injectionGuard.ts`.
- Ri-uso `aiActionRiskGate.ts` per gating azioni.
- Ri-uso `agentPersonaLoader.ts` con persona "Triage Editor".
- Trigger deep search Scout via tabella `deep_search_jobs` per evitare blocchi sincroni > 5s.
- Telemetria: ogni run logga in `edge_metrics` (latency, token, confidence) — risolve anche il finding "telemetria spenta" del routing audit 2026-05-04.
- Test regressione: 20 mail seed reali (anonimizzate) coprono i casi: quotazione, problema operativo, consulenza, pubblicità, auto-reply, risposta a campagna, fornitore con cambio intent.

---

## Cosa NON faccio (per scelta)

- Non creo enum chiusi di categorie nel codice.
- Non tocco `check-inbox` né IMAP.
- Non sposto la logica di smistamento mittente esistente.
- Non auto-eseguo invii o cambi lead_status senza approvazione umana.

## Piano: Identità TMWE + Routing per urgenza con alert WhatsApp ai responsabili

### Obiettivo
1. Riscrivere l'identità del sistema (TMWE / Find Air, non WCA) e iniettarla in tutti i prompt AI inbound/outbound.
2. Introdurre un **modello a 2 assi** (categoria business + urgenza testuale 0-100) per classificare ogni mail in arrivo.
3. Costruire un **router di alert WhatsApp** che invia autonomamente messaggi ai responsabili quando l'urgenza è alta, con rubrica gestita da UI in Settings.
4. Rinominare il sistema in **TMWE Partner Connect** (label UI/branding, no rename tecnico di tabelle/route).

---

### Step 1 — KB canonica "TMWE Identity & Inbound Doctrine" (priorità 100)

Una sola card SSOT in `kb_entries`, riusata da tutti i prompt:

- **Title**: `TMWE — Identità, Find Air, Doctrine inbound`
- **Category**: `doctrine` · **Priority**: 100 · **Tags**: `business_context`, `tmwe`, `find_air`, `inbound_priority`, `funnemail`, `email_classification`, `outreach`, `content_intelligence`, `alert_routing`
- **Contenuto**:
  - **Chi siamo**: Transport Management Srl (Peschiera Borromeo) · brand TMWE · prodotto Find Air (booking ibrido real-time desktop+mobile per cargo aereo, corriere espresso, trasporti via terra; prezzi pickup+delivery+dogana inclusi; primo ibrido al mondo). NON siamo WCA.
  - **5 categorie business** (esempi linguistici IT/EN per ciascuna):
    - `operations` — esecuzione servizio: booking, ritiri, consegne, dogana, problemi cargo, tracking, missed pickup, delay
    - `administrative` — fatture, pagamenti, statement, banche, carte di credito
    - `commercial_demand` — cliente/partner che ci dà lavoro o chiede quotazione (money-in)
    - `commercial_supply` — partner che si propone con tariffe/capacity
    - `informational` / `system` / `newsletter` / `bounce`
  - **Regola di priorità reale**: mancare un servizio o un alert urgente costa 100× più di mancare una mail commerciale. Operativo+amministrativo URGENTE batte tutto. Commercial demand viene secondo. Standard ops/admin terzo. Supply quarto. Newsletter quinto.
  - **Pitch Find Air** da iniettare nelle risposte commerciali (demand e supply).

### Step 2 — Nuovo prompt operativo "Inbound Triage" (context: `classification`, priority 95)

Output AI (urgenza **aperta**, come richiesto):
```
{
  "business_category": "operations|administrative|commercial_demand|commercial_supply|informational|system|newsletter|bounce",
  "urgency_score": 0-100,
  "urgency_reason": "frase libera che spiega perché",
  "priority_bucket": "P1_urgent|P2_commercial|P3_standard_ops|P4_supply|P5_noise",
  "should_alert": boolean,
  "alert_categories": ["operations_urgent" | "admin_urgent" | ...],
  "suggested_summary_for_alert": "max 280 char per WhatsApp"
}
```

Iniettato in `classify-inbound-message` insieme ai prompt esistenti. Score 0-100 libero, niente enum chiuso (rispetta doctrine "AI Prompt Freedom").

### Step 3 — Rubrica responsabili (DB + UI)

**Tabella** `alert_recipients`:
- `id`, `user_id` (owner), `name`, `role`, `whatsapp_e164` (validato, normalizzato), `email` (opzionale per copia)
- `categories` (text[]) — es. `['operations_urgent','admin_urgent']`
- `min_urgency_score` (int default 70) — soglia personale
- `is_active`, `quiet_hours_start/end` (HH:MM, opzionale), `timezone` (default Europe/Rome)
- `created_at/updated_at` · **RLS user-scoped**

**Tabella** `alert_dispatch_log`:
- `id`, `recipient_id`, `message_id` (FK channel_messages), `channel` (default `whatsapp`), `payload`, `status` (`sent|failed`), `dedup_key`, `error`, `sent_at`
- Indice unique su `(recipient_id, message_id)` per **idempotenza** (no doppi alert).

**UI** `/v2/settings/alert-routing`:
- Lista card responsabili (nome, ruolo, WA, badge categorie attive, soglia)
- CRUD via DAL `src/data/alertRecipients.ts`
- Test button: "Invia alert di prova" → manda WA test al numero
- Sezione "Ultimi 50 alert" da `alert_dispatch_log`

### Step 4 — Edge function `dispatch-urgent-alert`

Triggerata fire-and-forget da `classify-inbound-message` quando `should_alert=true`:
1. Carica `alert_recipients` filtrati per `categories ∩ alert_categories` e `urgency_score ≥ min_urgency_score` e `is_active`.
2. Per ciascun recipient:
   - Verifica idempotenza su `alert_dispatch_log(recipient_id, message_id)`
   - Verifica quiet_hours
   - Compone messaggio template fisso (no AI, no journalistReview): `🚨 ALERT [CATEGORIA] · {summary} · da: {from} · {subject_truncated} · [link a /v2/email-intelligence?msg={id}]`
   - Invia via `extension_dispatch_queue` (canale WhatsApp esistente) o direttamente via WA bridge esistente
   - Logga su `alert_dispatch_log`
3. **Bypass autorizzato di journalistReview** SOLO per alert template-based (no contenuto AI free-form). Richiede flag `is_system_alert=true` nel payload + commento in codice + memory update.

### Step 5 — Aggiornare prompt esistenti (Prompt Lab DB, niente file TS)

Snapshot automatico via trigger `snapshot_operative_prompt`:

| Prompt | Modifica |
|---|---|
| Funnemail Classifier | Cita la nuova KB TMWE; chiede output a 2 assi |
| Content Intelligence — Lettura Contenuto Mail | Aggiunge `urgency_score`, `should_alert`, `alert_categories` allo schema |
| Group-Aware Classification | Sostituisce riferimenti "WCA" con "TMWE/Find Air" |
| Outreach Flow + WCA Filosofia | Pitch riscritto su Find Air; titolo da rinominare "TMWE Filosofia & Find Air" |
| Lead Qualification v2 | `commercial_supply` non promuove a `qualified` automatico (resta prospect con tag `wants_to_supply_us`) |
| Quote Response (KB) | Specifica: si applica a `commercial_demand`, NON a `commercial_supply` |

Nuova KB `public/kb-source/operative/supply-offer-response.md` (template ringraziamento+pitch Find Air).

### Step 6 — Rebranding "TMWE Partner Connect"

- Aggiornare `index.html` `<title>` + meta description
- `src/i18n/index.ts` chiavi app name (cerco quelle già esistenti)
- Sidebar/topbar logo testuale dove compare il nome prodotto
- README e docs (solo i pubblici): aggiornamento minimo
- **NESSUN rename** di tabelle, route `/v2/*`, edge functions, env vars (rischio rotture > beneficio)

### Step 7 — Test di regressione

In `prompt_test_cases` aggiungiamo 8 mail tipo:
1. Cliente diretto urgente "merce ferma in dogana" → P1, alert_operations
2. Banca "blocco conto domani" → P1, alert_admin
3. Carta credito alert bloccata → P1, alert_admin
4. Statement mensile carta → P3 standard
5. Partner che ci dà lavoro EN "need pickup MXP" → P2 commercial_demand
6. Trasportatore che propone tariffe → P4 commercial_supply
7. Newsletter → P5
8. OOO automatico → info_only no alert

Eseguiti via `prompt-test-runner`.

---

## Dettagli tecnici

- **Loader unico** (`_shared/operativePromptsLoader.ts`) già in produzione: i nuovi prompt sono caricati automaticamente dopo INSERT in `operative_prompts`.
- **Editorial review** resta obbligatoria per email/WA/LI **commerciali**. L'eccezione `is_system_alert=true` è **solo** per template fissi di alert tecnici (non testo generato dall'AI).
- **Hard guards** invariati. **Soft-delete** invariato. **CORS whitelist** invariata.
- **Vincolo IMAP**: nessuna modifica a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `process-email-queue`.
- **DAL only**: nuovo `src/data/alertRecipients.ts` + `src/data/alertDispatchLog.ts`. Nessun `supabase.from()` in UI.
- **Type safety**: zero `any`, schemi Zod su payload alert.
- **Memory update finale**:
  - nuova entry `mem://business/tmwe-identity-and-find-air` (SSOT identità)
  - nuova entry `mem://features/inbound-triage-and-wa-alert-routing`
  - aggiornare core: rimuovere ogni "noi WCA" residuo nei mem
  - eccezione documentata: `mem://tech/editorial-review-layer-mandatory` aggiunge nota su template-only system alerts

---

## Aperto / da decidere durante implementazione

- Quale canale WA usare in concreto: passare per `extension_dispatch_queue` (più sicuro, audit) vs. invocazione diretta del bridge WhatsApp. → propendo per la coda esistente per mantenere log unificato.
- Dedup window: idempotenza per `(recipient_id, message_id)` è bastante; non servono retry custom.

Pronto a procedere alla implementazione step 1→7 al tuo OK.
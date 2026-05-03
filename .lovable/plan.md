## Obiettivo

Trasformare le card del Cestinone da "riga compatta" a **scheda di lavoro completa** che dà al venditore, in un colpo d'occhio + due click, **tutto** ciò che serve per decidere: cosa stiamo per mandare, a chi, da parte di chi, in che contesto, e in che stato è la pratica.

---

## Anatomia della nuova card (più alta, stessa larghezza)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 📧 EMAIL  ·  Da approvare  ·  🇩🇪 DE  ·  ⏱ 2h fa                    │  ← header riga 1
│ 🤖 LUCA (Director)  ·  🎯 Campagna "Spring DACH"  ·  Job #482         │  ← header riga 2
│ ─────────────────────────────────────────────────────────────────── │
│ "Re: Quotation Hamburg→Genoa LCL"                                    │  ← oggetto grande
│ → Müller Logistics GmbH  ·  partner WCA #12834  ·  cliente attivo    │  ← destinatario + tipo
│ ✉ purchasing@mueller-log.de   ✈ Holding 4gg                          │
│                                                                      │
│ [Anteprima] [Destinatario] [Origine] [Storico]                       │  ← TABS card-interne
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ Hi Stefan, thank you for the request. Please find below ...     │  │
│ │ (corpo email completo, scrollabile, max-h ~280px)               │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ [✅ Conferma e invia]  [✏ Modifica]  [⏸ Rinvia 1h ▾]  [🗑 Annulla] │
│                                              [↗ Vai all'origine]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Header (sempre visibile, 2 righe)

**Riga 1 — Identità del messaggio**
- Icona canale grande + label (`Email` / `WhatsApp` / `LinkedIn` / `Voce`)
- Badge stato colorato (`Da approvare` / `Schedulato` / `In coda` / `Bloccato`)
- 🏳️ Bandiera grande con codice paese (riusa `EntityRowFlag`)
- "Età" (`2h fa`, `domani 09:00` se schedulato)
- Tipo entità: chip `Partner WCA` / `Cliente` / `Lead` / `Prospect` (colore distinto)

**Riga 2 — Contesto operativo**
- 🤖 **Agente AI** che ha generato il contenuto (nome persona: LUCA / Aurora / Robin / "Manuale operatore")
- 🎯 **Origine**: `Campagna "X"` / `Risposta inbound` / `Mission Y` / `Manuale` / `Holding pattern auto-touch`
- ID job/coda piccolo a destra (es. `Job #482`)

### Corpo principale (sotto header)

- **Oggetto** (font medium, 2 righe max)
- **Destinatario espanso**: nome contatto + azienda + tipo (partner WCA #id / cliente / lead) + status badge
- **Handle del canale**: email / numero WA / url LinkedIn (cliccabile per copia)
- Eventuali **flag rapidi**: ✈ Holding Pattern (con giorni), 🔁 Retry n/max, ⚠ Errore precedente

### Tabs interni alla card (default = Anteprima)

| Tab | Contenuto |
|---|---|
| **Anteprima** | Corpo completo del messaggio (HTML renderizzato per email, testo per WA/LI). Scrollabile, max-height ~280px. Mostra firma. |
| **Destinatario** | Profilo veloce: ragione sociale, città, country, lead status, ultimo contatto, n° interazioni, score, link "apri scheda partner". |
| **Origine** | Pannello "perché stiamo mandando questo": campagna + step + A/B variant, oppure trigger (risposta inbound che cita estratto), oppure mission. Mostra agente AI e prompt usato (collassato). Indica se è stata fatta una **Deep Search** sul partner (✅ data / ❌ "non ancora — [Esegui Sherlock]"). |
| **Storico** | Timeline ultimi 5 touch col partner (email/WA/LI in/out) + ultimo reply inbound se presente. Riusa la timeline già esistente. |

### Footer azioni (sempre visibile)

- ✅ **Conferma e invia** (passa per editorial review come oggi — intoccato)
- ✏ **Modifica** (apre composer pre-compilato)
- ⏸ **Rinvia** con menu: `+1h` / `+4h` / `domani 09:00` / `lunedì`
- 🗑 **Annulla** (soft-delete via trigger DB)
- ↗ **Vai all'origine** (link diretto: cockpit / campaign jobs / outreach queue)

---

## Dati extra da caricare

L'attuale `fetchCestinone` prende solo i campi minimi. Estendiamo:

- **email_campaign_queue**: aggiungere `html_body, retry_count, error_message, message_id, failed_at, opened_at, open_count, draft_id, operator_id, idempotency_key`
- **campaign_jobs**: aggiungere `company_name, country_code, country_name, city, email, phone, job_type, batch_id, operator_id, notes` + lookup nome campagna da `batch_id`
- **cockpit_queue**: risolvere `source_type/source_id` per recuperare il messaggio reale (email_drafts / outbound_dispatch_queue)
- **outreach_queue**: aggiungere `body, attempts, max_attempts, last_error, priority, replied_at, created_by, contact_id`

**Lookup batch unici** (1 query):
- `partners`: `company_name, country_code, lead_status, partner_type, wca_id, profile_description`
- `profiles`: `display_name` per `operator_id` (= "agente che ha generato")
- `campaigns` / `email_campaigns`: nome campagna da `batch_id`
- `partner_outreach_state` o `holding_pattern_state`: flag ✈ + giorni
- `deep_search_runs` (o equivalente Sherlock): ultima esecuzione per partner → mostra ✅/❌ nella tab Origine

Tutto via `Promise.allSettled` + `.in("id", [...])` — **nessuna nuova tabella**, nessuna nuova RLS.

### Nuovo tipo `CestinoItem` (estensione retro-compatibile)

```ts
interface CestinoItem {
  // …campi attuali…
  // identità arricchita
  partnerName: string | null;
  partnerType: "wca_partner" | "customer" | "lead" | "prospect" | null;
  partnerCountryCode: string | null;
  partnerLeadStatus: string | null;
  partnerWcaId: number | null;
  // contesto AI/origine
  agentName: string | null;          // "LUCA" / "Aurora" / "Manual"
  campaignName: string | null;       // "Spring DACH" / null
  campaignBatchId: string | null;
  triggerKind: "campaign" | "inbound_reply" | "mission" | "manual" | "auto_touch" | "cockpit_draft";
  // contenuto pieno
  bodyText: string | null;
  bodyHtml: string | null;
  // segnali operativi
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  holdingDays: number | null;
  scheduledAt: string | null;
  // intelligence
  deepSearchDoneAt: string | null;   // null = mai fatta → CTA "Esegui Sherlock"
}
```

---

## Modifiche file

### Nuovi
- `src/v2/ui/molecules/CestinoCardHeader.tsx` — header 2 righe (canale, stato, bandiera, agente, campagna)
- `src/v2/ui/molecules/CestinoCardTabs.tsx` — wrapper Tabs interno (Anteprima/Destinatario/Origine/Storico)
- `src/v2/ui/molecules/CestinoCardFooter.tsx` — barra azioni con menu Snooze
- `src/v2/ui/organisms/CestinoCardV2.tsx` — composizione delle tre molecules

### Estesi
- `src/data/cestinone.ts` — campi extra + batch lookup partners/campaigns/profiles/deep_search
- `src/v2/hooks/useCestinone.ts` — propagazione tipi + memoization filtri
- `src/v2/ui/pages/CestinonePage.tsx` — sostituisce `CestinoCard` inline con `CestinoCardV2`

### Intoccato
- Editorial review (`journalistReview`) — passa **solo** dalla CTA Conferma → naviga al canale d'origine
- Trigger soft-delete DB
- Tutte le tabelle (no migration)

---

## Comportamenti speciali

- **Deep Search nella tab Origine**: se `deepSearchDoneAt` è null mostriamo banner giallo `"Nessuna deep search fatta su questo partner"` con CTA `Esegui Sherlock` che lancia la pipeline esistente. Se fatta, mostriamo data + link al report.
- **"Vai all'origine"**: link route-aware → `email_campaign_queue` → `/v2/communicate/outreach?queue=ID`, `campaign_jobs` → `/v2/communicate/campaigns?job=ID`, `cockpit_queue` → `/v2/communicate/outreach?cockpit=ID`, `outreach_queue` → `/v2/communicate/outreach?multi=ID`.
- **Snooze esteso**: oggi solo `+1h`. Aggiungiamo dropdown con `+1h / +4h / domani 9:00 / lunedì 9:00`. Snooze su `outreach_queue` e `cockpit_queue` non supportato → opzione disabilitata con tooltip.
- **Tipo partner** (chip colorato): derivato da `partner_type` su `partners`; fallback `lead_status` (`active_customer` → "Cliente").

---

## Ordine implementazione

1. Estendere `fetchCestinone` con campi extra + 4 lookup paralleli (partners / campaigns / profiles / deep_search).
2. Aggiornare `CestinoItem` e `useCestinone`.
3. Creare `CestinoCardHeader`, `CestinoCardTabs`, `CestinoCardFooter`, `CestinoCardV2`.
4. Sostituire la card inline in `CestinonePage`.
5. Aggiungere link "Vai all'origine" + Snooze esteso + CTA Sherlock nella tab Origine.

Tutto fatto sui dati che già abbiamo in DB. **Zero migration, zero modifiche all'editorial review, zero modifiche all'invio.**

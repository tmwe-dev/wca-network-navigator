## Obiettivo

Eliminare il caos del "dopo-clic-Invia". Oggi una bozza/un invio in attesa può vivere in 5 posti diversi (Cockpit, In Uscita, Risposte, Attività, Approvazioni). Lo riduciamo a **un solo cestinone**: la coda unica delle cose da confermare prima che partano davvero.

---

## Nuova mappa della sidebar

```text
Esplora      → Network, Contatti, Biglietti           (i "laghi": pesci crudi)
Pipeline     → Kanban, Duplicati                       (CRM lifecycle, niente outreach)
Cestinone ⭐ → UNICA coda di cose "in cottura"        (NUOVA pagina top-level)
Comunica     → Inbox, Outreach, Componi, Campagne     (creo / leggo)
Agenda       → vista azioni del giorno                 (top-level a sé, già esiste)
```

---

## Cos'è il Cestinone

**Una sola pagina, una sola lista.** Ogni riga = un'azione che sta per partire o che richiede una decisione. L'operatore decide solo: ✅ Conferma · ✏️ Modifica · ⏸ Rinvia · ❌ Annulla.

Sorgenti unificate (oggi sparse):
- `email_campaign_queue` (status = pending / queued / scheduled)
- `campaign_jobs` (in attesa di approvazione)
- Cockpit queue (bozze AI proposte)
- Bozze email non spedite
- Messaggi WA/LinkedIn in `outbound_dispatch_queue` pending
- Risposte inbound che richiedono mossa (oggi "Risposte" / Holding Pattern)

Filtri rapidi in alto (chip):
- **Canale**: Email · WhatsApp · LinkedIn · Voce
- **Origine**: Manuale · AI · Campagna · Risposta inbound
- **Stato**: Da approvare · Schedulata · Bozza · Bloccata

Default: tutto quello che è in "circuito d'attesa" + mostrato finché non è stato eseguito o cancellato (regola già definita).

---

## Cambi alle sezioni esistenti

### `/v2/pipeline` → solo CRM
- ✅ Tieni: **Kanban**, **Duplicati**
- ➡️ Sposta: **Campagne** → dentro Comunica come tab
- ➡️ Sposta: **Agenda** → top-level sidebar (route `/v2/agenda` già esistente)
- Redirect retro-compatibili da `/v2/pipeline/campaigns` e `/v2/pipeline/agenda`

### `/v2/communicate` → semplificata
- Tabs: **Inbox** · **Outreach** · **Componi** · **Campagne** (nuova)
- Rimossa la tab **Approvazioni** (la SortingPage attuale, che era smistamento, non approvazione invio): la sua funzione di "decidere su una mail" confluisce nel Cestinone.

### `/v2/communicate/outreach` → snellita
Oggi ha 5 tab verticali (Cockpit, In Uscita, Risposte, Attività, Strumenti). Diventa:
- **Cockpit** (stats e grafici, resta)
- **Storico** (tutto quello che è già stato inviato/risposto/chiuso, sola lettura)
- **Strumenti** (A/B test, scheduling, coda AI)

➡️ **In Uscita**, **Risposte**, **Attività** → confluiscono nel **Cestinone**.

### `/v2/cestinone` (NUOVO) → top-level
Unica vista azione. Sotto-tab solo per "vista":
- **Tutto** (default) · **Da approvare** · **Schedulato** · **Bloccato**

---

## Comportamento del cestinone (regole già condivise)

- Un partner entra nel cestinone appena ha un'attività in attesa di invio.
- Esce automaticamente quando l'attività viene **eseguita** (inviata davvero) → torna "free" e ricontattabile.
- Se l'attività viene **cancellata** dal cockpit/altre fonti senza esecuzione → torna "free" subito.
- Holding Pattern (✈️) resta come **badge visivo** sulla card, non come pagina separata.
- Editorial review (`journalistReview`) resta obbligatorio prima del send fisico (intoccabile).

---

## Dettaglio tecnico (per dopo)

- **Hook unico** `useCestinone()` che fa fan-out su: `email_campaign_queue`, `campaign_jobs`, `outbound_dispatch_queue`, `cockpit_queue`, bozze. Ritorna `CestinoItem[]` normalizzato (`{id, channel, partner, subject/preview, status, source, scheduled_at, action: {confirm, edit, snooze, cancel}}`).
- **DAL nuovo**: `src/data/cestinone.ts` che orchestra le sorgenti via Promise.allSettled. Nessuna nuova tabella DB.
- **Mutazioni**: confirm → enqueue normale del canale; cancel → soft-delete (trigger DB lo gestisce); snooze → update `scheduled_at`.
- **Realtime**: subscribe alle 3 tabelle sorgente per refresh live.
- **Query keys** centralizzati in `queryKeys.cestinone.*`.
- **Route**: aggiungere `/v2/cestinone` in App.tsx; aggiungere voce in sidebar; redirect da vecchi tab Outreach (In Uscita/Risposte/Attività) → `/v2/cestinone`.
- **Codice vecchio**: NON cancellato (regola "no delete in `src/components`"), solo non più referenziato dal router. `HoldingPatternCommandCenter` riusato come "vista compatta" dentro la card del Cestinone.
- **Editorial review**: invariato. Hook `useCestinone().confirm()` chiama lo stesso path di invio attuale.

---

## Ordine consigliato di implementazione

1. **Crea `/v2/cestinone`** (route + voce sidebar + pagina vuota con tab vista).
2. **DAL `cestinone.ts` + hook `useCestinone`** che aggrega le sorgenti già esistenti — solo lettura.
3. **Card unificata** con CTA Conferma/Modifica/Rinvia/Annulla che riusa `ApprovalPanel.tsx` e gli handler già esistenti dei vari canali.
4. **Sposta tab**: Campagne → Comunica, Agenda → top-level. Aggiungi redirect.
5. **Snellisci OutreachPage** rimuovendo tab "In Uscita / Risposte / Attività" (redirect → cestinone).
6. **Rimuovi tab "Approvazioni"** da Comunica (redirect → cestinone).

Dopo lo step 1-3 avrai già il cestinone funzionante. Gli step 4-6 sono pulizia, reversibili in qualunque momento.

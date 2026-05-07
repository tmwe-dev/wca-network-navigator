# Audit Funnemail — diagnosi e piano di fix

Analisi riga-per-riga di `FunnemailInboxPage`, `useFunnemailInbox`, `InboxGroupsSidebar`, `useFunnemailInboxSidebarData`, `funnemailInbox` (DAL), `EmailDetailView` + verifica DB.

---

## 1. Bug — cliccare una cartella in sidebar "non mostra nulla"

**Causa esatta** (`useFunnemailInbox.ts` righe 140–146):

```ts
React.useEffect(() => {
  if (groupedQ.isLoading || mails.length === 0 || filteredMails.length > 0) return;
  const hasActiveFilter = selectedFolder !== "all" || g.filters.funnemailSearch.trim() || g.filters.funnemailView !== "all";
  if (!hasActiveFilter) return;
  g.batchUpdate({ funnemailFolder: "all", funnemailSearch: "", funnemailView: "all" });
  toast.message("Filtri resettati: nessun risultato con i filtri attivi");
}, [filteredMails.length, g, groupedQ.isLoading, mails.length, selectedFolder]);
```

Questo effetto "auto-resetta" la cartella selezionata appena `filteredMails.length === 0`. Ma il conteggio in sidebar è calcolato sulle **ultime 1000 mail** (`MAX_MESSAGES`), mentre il filtro lavora sullo stesso set: se per qualunque motivo (race tra refetch sidebar/lista, cambio operatore, view "non lette" attiva) la cartella momentaneamente è vuota, **l'effetto la rimette su "all" e mostra il toast "Filtri resettati"**. Risultato visivo: il click sembra non funzionare.

**Conseguenze collaterali:**
- I badge mostrano `5`, ma cliccando la cartella la lista è vuota per un istante (refetch) → l'autoreset scatta → utente non vede mai le mail.
- L'autoreset confonde anche `funnemailView` (lo riporta a "all") cancellando scelte legittime dell'utente.

**Fix:** rimuovere l'autoreset. Sostituirlo con uno stato vuoto esplicito nella lista ("Nessuna email in questa cartella") + bottone "Mostra tutte le inbox" non automatico.

---

## 2. Bug — sidebar e tasti "non funzionano"

`InboxGroupsSidebar` chiama `onSelect(slug)` → in entrambi i punti d'uso (page standalone e drawer) finisce su `g.setFilter("funnemailFolder", slug)`. Lo store funziona, ma viene **subito sovrascritto** dal medesimo bug §1. Per l'utente "i tasti non rispondono".

Sintomo correlato: il pulsante "Tutte le inbox" funziona perché `selectedFolder === "all"` non triggera l'autoreset.

**Fix:** stesso del §1. Eliminato l'autoreset, i tasti rispondono.

---

## 3. Bug — categoria suggerita / badge non visibili in lettura

`channel_messages.ai_classification_suggestion` esiste a schema (è già nel `MESSAGE_LIST_SELECT` del DAL), ma **`EmailDetailView` non lo legge**. Lo stesso vale per:
- `funnemail_decision` (già caricato dal DAL grouped, ma `EmailDetailView` non lo riceve perché prende solo `ChannelMessage`).
- `sender_intel` (idem).
- `partner_snapshot` (idem).

**Stato DB attuale:** `funnemail_decisions` ha solo **8 righe** in totale. Il problema è doppio:
- Il classificatore AI non è stato lanciato sulla maggior parte delle mail (manca un trigger/cron che invochi `funnemail-classify` sulle nuove mail).
- Anche quando esiste una decision, la UI non la mostra.

**Fix:**
1. **UI**: in `EmailDetailView` aggiungere una riga "Classificazione" sotto il subject che mostra (in ordine di priorità):
   - badge `funnemail_decision.folder_slug` se presente (con colore + label dalla cartella),
   - altrimenti `ai_classification_suggestion` come "suggerita" con stile dashed,
   - tooltip con `decision.reasoning` quando presente,
   - pulsante "Riclassifica" che chiama `ctrl.reclassify(message)` (già esistente nel hook, basta esporlo via prop).
2. **Hook/DAL**: passare a `EmailDetailView` la versione *grouped* (`ChannelMessage & { funnemail_decision, sender_intel, partner_snapshot }`) — `useFunnemailInbox.selectedMail` già la possiede, va solo tipizzata e propagata.

---

## 4. Bug — Deep Search non automatico

Oggi `DeepSearchEmailButton` in `EmailDetailView` (riga 241) è **solo manuale**. Non c'è alcun trigger automatico al primo apri di una mail il cui mittente non ha `sender_intel`.

**Fix proposto (cauto, opt-in):**
- In `useFunnemailInbox`, quando `selectedMail` cambia e `selectedMail.sender_intel === null` AND `funnemail_decision === null` AND `partner_snapshot === null`, scattare **una sola volta** (Map con TTL come l'autoMarkRead esistente) un `invokeAi("funnemail-classify", { mode: "auto-deep-search" })` che internamente faccia il deep search del dominio se necessario.
- Risultato: badge categoria appare entro pochi secondi dall'apertura senza click.
- Nessun side-effect in scrittura sul partner finché l'utente non lo conferma.

---

## 5. Audit lettura / agenda / alert

**Lettura (`read_at`)**:
- Auto-mark-read funziona solo per cartelle con `auto_mark_read=true` in `funnemail_policy`. Verificare in DB quante cartelle l'hanno settato (oggi `auto_mark_read: false` hardcoded nel DAL r.399 → **bug**: ignora la policy DB e disabilita sempre l'auto-read).
- Mark-as-read on click usa `useMarkAsRead`. Funziona.
- Bulk mark read funziona via `markFunnemailMessagesRead`.

**Fix:** in `funnemailInbox.ts` r.399 leggere `f.funnemail_policy?.auto_mark_read` invece di hardcodare `false`. (Ma `funnemail_folders` non ha la colonna `funnemail_policy` — è in `email_sender_groups`. Va valutato se applicarla per gruppo mittente o per cartella destinazione: scelta esplicita da fare con te.)

**Agenda**:
- `funnemail_folders.accept_into_agenda` esiste, `funnemail_decisions.goes_to_agenda` esiste, ma **nessuna UI in `EmailDetailView` o nella lista mostra il badge "in agenda"** né dà un'azione "accodalo all'agenda". L'integrazione esiste a livello DAL/agente AI ma è invisibile.
- Cron/trigger di scheduling: da verificare con `pg_cron` (job `process-funnemail-agenda` se esiste).

**Fix:** badge "📅 In agenda" sulla card lista quando `funnemail_decision.goes_to_agenda=true`, link rapido a /v2/agenda nel detail.

**Alert**:
- Cartella `alerts` esiste come destinazione. `funnemail_decisions.urgency` ha valori `critical|high|normal|low` ma **nessun toast / nessuna notifica desktop** scatta sui nuovi messaggi `urgency=critical`.
- Realtime su `channel_messages` non è attivo per Funnemail (solo per `funnemail_message_claims`).

**Fix (cauto, opt-in dopo conferma):** subscription realtime su nuove righe `funnemail_decisions` con `urgency in (critical, high)` → toast + suono opzionale.

---

## 6. Altri rischi minori rilevati

- `useFunnemailInbox` ha due query identiche (page + sidebar drawer) con la stessa key, ma con `queryFn` ricreate: rischio di doppio fetch parallelo all'apertura. **Da consolidare in un singolo hook condiviso** quando si tocca il punto §1.
- `setSelectedMessageId(null)` quando cambia cartella (r.91) + autoselezione del primo (r.158) → al click su cartella vuota l'utente vedrebbe "loading flash" prima dell'autoreset. Stesso fix del §1.

---

## Cosa farò se confermi (in ordine)

**Fase 1 — Fix bug bloccanti (no AI, solo UI/hook):**
1. Rimuovere autoreset filtri in `useFunnemailInbox` (§1+§2). Sostituire con stato vuoto esplicito + CTA non automatica.
2. Propagare a `EmailDetailView` il tipo grouped (`funnemail_decision`, `sender_intel`, `partner_snapshot`, `ai_classification_suggestion`) e mostrare:
   - badge cartella corrente,
   - badge "suggerita" con tooltip reasoning,
   - pulsante "Riclassifica" (riusa `reclassify`),
   - badge "📅 In agenda" se `goes_to_agenda`,
   - badge urgency colorato.
3. Fix `auto_mark_read` hardcoded a `false` (§5) → lettura coerente con la policy DB (chiederò conferma su scope: per cartella vs per gruppo mittente).

**Fase 2 — Auto deep-search opt-in (con tua approvazione):**
4. Trigger one-shot `funnemail-classify` quando si apre una mail senza decision/intel/partner.

**Fase 3 — Notifiche/Realtime alert (con tua approvazione):**
5. Realtime su `funnemail_decisions` urgency critical/high → toast.

**Vincoli rispettati:**
- Niente modifiche a `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (memoria `Email Code Integrity`).
- Tutte le chiamate AI passano da `invokeAi()` con scope (charter rispettato).
- Nessuna modifica a `journalistReview` o agli operative prompts.
- Nessun refactor opportunistico fuori dai punti elencati.

**File toccati Fase 1:** `src/v2/hooks/useFunnemailInbox.ts`, `src/components/outreach/EmailDetailView.tsx`, `src/v2/ui/pages/FunnemailInboxPage.tsx`, `src/data/funnemailInbox.ts` (solo r.399 + tipizzazione).

Confermi Fase 1 (sblocca subito click cartelle + mostra categoria)? Le Fasi 2–3 le decidiamo dopo aver visto il risultato di Fase 1.

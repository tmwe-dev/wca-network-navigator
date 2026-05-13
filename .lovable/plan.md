
## Cosa c'è in agenda di booking@tmwe.it (oggi)

13 azioni `pending`, **tutte** create oggi 12/05 dalla `postClassificationPipeline`, **tutte** sullo stesso partner `c126c50f… = "Transport Management srl"` e **tutte** generate da email arrivate da `sara.triassi@tmwe.it` (e altri colleghi interni `@tmwe.it`).

Cinque problemi reali trovati sui dati:

1. **La tua azienda è registrata come partner.**
   `partners.id c126c50f…` è "Transport Management srl" con `email = booking@tmwe.it`, `wca_id 112839`, `country IT`. In `partner_contacts` ci sono `booking@tmwe.it`, `sara.triassi@tmwe.it`, `elizabeth.feria@tmwe.it`, `pasquale.arianna@tmwe.it`. È stato auto-creato dallo scraping WCA e non è mai stato escluso.

2. **Le email interne (collega → collega) vengono trattate come "lead in risposta".**
   Quando arriva una mail da `sara.triassi@tmwe.it` nella casella `booking@tmwe.it`, `classify-inbound-message → stagePostClassification → emailRouter` la risolve sul partner sbagliato (TMWE stessa) e crea un `activities.follow_up`. Non c'è guardia "stesso dominio del proprietario".

3. **Niente description leggibile.**
   `emailRouter.ts:160/322` e `questionAndComplaintHandler.ts:93` scrivono `description = input.aiSummary || fallback`. Il chiamante (`stagePostClassification.ts:31`) passa `aiSummary = result.intent`, che è uno **slug** (`booking_request`, `quote_request`, `cargo_status`…), non un testo. Risultato: in agenda compare "13 azioni oggi" senza description e con titoli identici.

4. **Niente collegamento all'email originale.**
   Le INSERT di activities non valorizzano `email_subject`, `email_body`, `message_id_external`, `thread_id`. Quindi nel pannello azione non hai modo di vedere la mail (anteprima vuota / "Apri partner" è l'unico CTA utile).

5. **Nessuna deduplica.**
   La pipeline gira a ogni inbound; nessun unique su `(user_id, partner_id, message_id_external, classification)`. Stesso messaggio classificato due volte = due righe agenda. Oggi infatti ci sono 4 follow-up `cargo_status`, 4 `quote_request`, 3 `booking_request`, 2 `interested` sullo stesso partner.

### Files coinvolti (sorgente del bug)

- `supabase/functions/_shared/postClassificationPipeline.ts` (orchestratore, manca guardia self-domain e flag `isInternal`)
- `supabase/functions/_shared/emailRouter.ts` (handleInterested L153, handleFollowUp L315: insert activities incomplete)
- `supabase/functions/_shared/questionAndComplaintHandler.ts` (L87, L228: stessa insert pattern)
- `supabase/functions/classify-inbound-message/stages/stagePostClassification.ts` (L31: passa intent slug come aiSummary)

---

## Piano in 3 step (atomico, niente refactor)

### Step 1 — Guardia "internal sender / self-partner" (sorgente del rumore)

In `postClassificationPipeline.ts` aggiungere all'inizio di `runPostClassificationPipeline`:

- Carica il dominio del proprietario: `select email from auth.users where id = userId` via `auth.admin` **oppure**, più semplice e già accessibile, derivarlo dalle mailbox attive del proprietario in `email_mailboxes` (campo email/from_address).
- Se `senderEmail` ha lo stesso dominio del proprietario → **short-circuit**: niente activities, niente pending action, niente reminder. Solo `result.actionsExecuted.push("skip_internal_sender")` e ritorna.
- Se `partnerId` punta a un partner il cui `email` o uno dei `partner_contacts.email` coincide con la mailbox del proprietario → stesso short-circuit + log `skip_self_partner` (un controllo, non distruttivo: non tocca i dati di quel partner).

Effetto: zero nuove righe da Sara/Elizabeth/Pasquale → booking. Le email interne restano scaricate e leggibili in Funnemail, ma non finiscono in agenda.

### Step 2 — Description, contesto email, deduplica nelle INSERT activities

Modifica **solo** dei 3 punti che fanno `from("activities").insert(…)`:

`emailRouter.ts:153` (handleInterested), `emailRouter.ts:315` (handleFollowUp), `questionAndComplaintHandler.ts:87` (handleQuestion).

In ognuno:

- **Description leggibile**: usare prima `input.aiSummary` **solo se** è una frase (length > 30, contiene spazi); altrimenti fallback umano del tipo `"Risposta classificata come ${category} da ${senderEmail}. Apri per leggere il messaggio."`.
- **Contesto email**: valorizzare `email_subject = input.subject`, `email_body = input.aiSummary || ""`, `message_id_external = input.messageId`, `thread_id = input.threadId`. Aggiungere i due campi opzionali a `RouterInput` / `QuestionComplaintInput` e propagarli in `stagePostClassification.ts` (già hanno `body.message_id`).
- **Dedup pre-insert**: prima di insert, `select id from activities where user_id=? and partner_id=? and message_id_external=? and source_meta->>'classification'=? and deleted_at is null limit 1`. Se esiste, skip + `result.actionsExecuted.push("skip_duplicate")`.

Niente nuove tabelle, niente migration: i campi `email_subject`, `email_body`, `message_id_external`, `thread_id` esistono già in `public.activities`.

### Step 3 — Bonifica dati esistenti (one-shot, soft)

Migration SQL minima:

- Soft-delete (UPDATE `deleted_at = now()`, `deleted_by = system`) delle 13 activities di oggi sul partner `c126c50f…` create da `source_meta->>'pipeline' = 'postClassification'` con sender interno `@tmwe.it`. **Niente DELETE fisico** (rispetta la regola globale soft-delete).
- Marcare il partner `c126c50f…` come **non actionable**: `UPDATE partners SET is_active=false, status_reason='self_company', deleted_at=now()` (soft) — così la pipeline e l'agenda lo escludono già senza altra logica.
- Stesso trattamento se in DB esistono altri `partners.email` o `partner_contacts.email` che coincidono con una mailbox attiva del proprietario (query in due righe).

### Cosa NON faccio

- Non tocco `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (memoria globale).
- Non cambio `funnemail` né l'editorial review.
- Non modifico la classificazione AI (resta intent/category attuali); solo il modo in cui usiamo `intent` per popolare la description.
- Niente refactor di `postClassificationPipeline.ts` oltre il guard iniziale.

### Verifica post-deploy

1. Eseguo manualmente `classify-inbound-message` su una mail interna di Sara: deve loggare `skip_internal_sender`, zero righe in `activities` con `created_at >= now()`.
2. Eseguo su una mail vera di partner esterno: nuova activity con `description` testuale, `email_subject` e `message_id_external` valorizzati, secondo run **non** crea duplicato.
3. Apro `/v2/agenda` come `booking@tmwe.it`: la lista "13 azioni oggi" sparisce; restano solo le azioni reali su partner reali.

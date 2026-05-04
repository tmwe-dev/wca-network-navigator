## Diagnosi

**Perché "Apri ora" apre la Command Page?**
In `AgendaActionPanel.tsx` (riga 116) il link punta a `/partners/${partner_id}`, ma in `App.tsx` quella rotta **non esiste**: c'è solo `/v2/*`. Il catch-all (`*`) redirige a `DEFAULT_HOME_ROUTE = "/v2/command"`. Da qui il salto alla Command Page.

**Agenda = circuito di attesa?**
No. Sono due concetti distinti:
- **Agenda** = elenco di `activities` (job da fare/fatti) filtrate per giorno.
- **Circuito di attesa** = `partner.lead_status = 'holding'`, attivato manualmente con la checkbox nella nota.
Un partner può essere in agenda senza essere in holding, e viceversa. Lo chiarirò con un badge esplicito nella card di agenda.

**La nota appare nella history come messaggio?**
Sì: oggi `AddNoteDialog` salva la nota in `interactions` (stessa tabella di email/WA/LI), quindi compare nella TIMELINE del partner come item generico. Va distinta visivamente come "Nota interna".

---

## Piano interventi

### 1. Fix "Apri ora" → apre il dettaglio partner reale
File: `src/components/agenda/AgendaActionPanel.tsx`
- Cambiare `partnerHref` da `/partners/${id}` a `/v2/explore/network?partnerId=${id}` (o la rotta v2 corretta che monta `PartnerDetailFull`/`PartnerDetailModal`).
- Stesso fix sul link "Apri partner" in alto a destra (riga 148).
- Verificare anche `PartnerDetailModal.tsx:211` che ha lo stesso bug.

### 2. Sostituire/affiancare le azioni "Delega" e "Rimanda 24h"
File: `src/components/agenda/AgendaActionPanel.tsx`
- Rimuovere "Delega" (disabled, non richiesta).
- Mantenere "Rimanda 24h" funzionante (oggi è disabled).
- Aggiungere nuovo bottone **"Programma futuro"** che apre un piccolo popover con date-picker e crea una nuova `activity` (tipo `follow_up` o `other`) con `due_date` futura, `assigned_to = user.id`, `partner_id` corrente, status `pending`.
- "Archivia" resta com'è.

### 3. Badge "✈ In attesa" nella card di Agenda
File: `src/components/agenda/AgendaDayDetail.tsx` (o equivalente che renderizza le card)
- Quando `activity.partners.lead_status === 'holding'`, mostrare il badge pulsante "✈ In attesa" già presente in `PartnerDetailHeader.tsx`, riusando `isInHoldingPattern()` da `@/constants/holdingPattern`.
- Stesso badge anche nell'header del `AgendaActionPanel`.

### 4. Nota visibile e distinta nella TIMELINE del partner
File: `src/components/partners/PartnerDetailActivity.tsx` (timeline)
- Verificare che gli item con `interaction_type = 'note'` (o `channel = 'note'`) vengano renderizzati con icona `StickyNote`, etichetta "Nota interna", autore (`created_by` → nome operatore), e il **testo completo** della nota nel body.
- Se la nota oggi non compare, controllare il filtro/sort in `useInteractions` o nel mapping della timeline.

---

## Dettagli tecnici

- Rotta corretta partner v2: da confermare leggendo `src/v2/routes.tsx` attorno a `NetworkPage` / `BusinessCardsViewV2` (sembra essere `/v2/explore/network` con query `partnerId`, oppure aprire `PartnerDetailModal` via store globale).
- Il "Programma futuro" deve usare `insertActivity` da `src/data/activities.ts` con `status: 'pending'`, `completed_at: null`, `reviewed: false`, `due_date` selezionata, e invalidare le query keys di agenda (`queryKeys.activities.*`).
- Per il badge holding nella card agenda serve che `useAgendaDayActivities` selezioni anche `partners.lead_status` (verificare il select).
- Nessuna modifica a edge functions, RLS o nodi critici (submit/AI/dedup). Modifiche solo UI + un nuovo insert in `activities` già coperto dalla DAL.

---

## Domanda aperta per te

Prima di implementare, confermami:
- "Programma futuro" deve creare una **nuova** activity futura (lasciando l'attuale come "fatta/annotata") oppure deve **spostare** l'activity corrente in avanti (aggiornando `due_date`)?

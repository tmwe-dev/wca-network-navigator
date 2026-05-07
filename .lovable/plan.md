## Obiettivo
Pulizia e correzioni UX su Funnemail Inbox e dettaglio email (sia `/v2/inbox` che `/v2/funnemail-inbox`), senza modificare logiche backend (check-inbox, IMAP, journalistReview, edge functions).

## 1. Sidebar filtri Funnemail
- **Rimuovere** i due dropdown "Email ↓" (sort priority/secondary) che non funzionano e confondono. Resta solo l'ordine default + drag&drop.
- **Rimuovere** il pulsante "Tutte le inbox" in alto: lasciamo solo le due sezioni esistenti (Prioritarie sopra, Secondarie sotto, + Da smistare/Archivio).
- Verificare che i tasti riga (selezione cartella) funzionino dentro il drawer filtri (al momento il click potrebbe essere intercettato dall'overlay).

## 2. Popover "Assegna gruppo" (`InlineGroupAssigner`)
- Mostra "Nessun gruppo definito" perché filtra `email_sender_groups` per `user_id` ma in realtà i gruppi attivi sono globali (visibili dalla sidebar). Rimuoviamo il filtro `eq("user_id", …)` allineandoci alla policy di visibilità globale già usata altrove.
- Layout: lista gruppi sopra, prompt sotto (già così), aggiungere icona/colore visibile.

## 3. Card email (Funnemail + Inbox principale)
- **In alto a destra**, sopra l'orario: badge **gruppo assegnato** (testo bianco/foreground forte). Se gruppo assente → badge **gruppo suggerito** (stesso slot, label "suggerito: X" colore muted).
- Pulire la riga chip in basso: rimuovere il duplicato gruppo se già visibile in alto.
- Tutti i testi della card in `text-foreground`/`text-primary`, niente `text-muted-foreground` su info chiave.

## 4. Toolbar lista mail (sopra le righe)
- Aggiungere pulsante **Refresh** che nasconde le mail già lette (toggle `Mostra solo non lette`, persistito in localStorage).
- Aggiungere azione **Elimina** (soft-delete) sia su singola mail (in `EmailMessageActions`) che su selezione bulk.

## 5. Pannello dettaglio email (colonna destra)
- **Eliminare gli sfondi pieni** dei pulsanti header (Letto/Rispondi/Inoltra/Deep Search/Chiudi) → variant `ghost` con bordo sottile.
- Aggiungere **icona stella** sulla colonna destra del reader quando esiste già un risultato Deep Search per quel mittente (badge cliccabile per riaprirlo).
- **Header multi-colonna**: oggi è tutto stackato verticalmente. Riorganizzare in 2 colonne:
  - Sinistra: oggetto, mittente, CC/BCC, data
  - Destra: gruppo, categoria AI, urgency, partner badges, dettagli tecnici
- Mantenere identica la logica (no modifiche a hook/DAL).

## 6. File toccati (presumibili)
- `src/v2/ui/pages/funnemail-inbox/InboxGroupsSidebar.tsx`
- `src/components/outreach/email/InlineGroupAssigner.tsx`
- `src/v2/ui/pages/funnemail-inbox/FunnemailMailCard.tsx`
- `src/v2/ui/molecules/email/MailRowChrome.tsx`
- `src/components/outreach/EmailMessageList.tsx`
- `src/components/outreach/EmailMessageActions.tsx`
- `src/components/outreach/EmailDetailView.tsx`
- `src/v2/ui/pages/funnemail-inbox/FunnemailListToolbar.tsx`
- `src/v2/hooks/useFunnemailInbox.ts` (solo wiring stato `hideRead`)

## Fuori scope
- Nessuna modifica a edge functions, RLS, IMAP sync, journalistReview.
- Nessun refactor architetturale.

Procedo step 1→5 sequenzialmente in un'unica passata.

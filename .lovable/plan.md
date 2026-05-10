## Piano interventi (regressioni + richieste UI)

### 1. WCA Partner — filtro "Cerca partner" non applica selezione
**Problema**: cliccando un partner nei risultati del search filter (es. *Transport Management srl*) appare il chip "Ricerca: ..." in alto ma `selectedPartnerId` non viene impostato → niente dettaglio sulla destra. Il filtro nazione invece funziona.
**Fix**: nel pannello sidebar `CERCA PARTNER` (componente filtro WCA in `NetworkPage`), il click sul risultato deve:
- chiamare `setSelectedPartnerId(partner.id)`
- propagare anche il filtro paese/città del partner (così la lista a destra lo mostra)
- chiudere il drawer filtri su mobile

### 2. Bottone "Esplora" bianco non richiesto
**Problema**: in alto compare un pulsante `Esplora` bianco fuori palette.
**Fix**: identificare il render (probabilmente `ExploreContextHeader.tsx` o `LayoutHeader.tsx`) e:
- rimuoverlo se duplicato del titolo `PageTitleHeader`
- oppure restilizzarlo con token semantici (`bg-secondary`/`bg-muted` + `text-foreground`) coerente col tema dark

### 3. Layout master-detail mancante in Network/CRM/Biglietti da Visita
**Problema**: solo la tab WCA Partner mostra lista + dettaglio del primo elemento. Le altre tab (Network, CRM, Biglietti da Visita) mostrano solo lista.
**Fix**: replicare lo stesso pattern `selectedId ?? firstItemId` di `NetworkPage` su:
- tab CRM (`CRMPage` / sotto-vista in NetworkPage)
- tab Biglietti da Visita (`BusinessCardsViewV2`)
- tab Network
Auto-selezione del primo elemento al mount + sync selezione → pannello dettaglio a destra.

### 4. Spostare "Finder API Catalog" dentro Config
**Problema**: voce di primo livello non desiderata.
**Fix**:
- rimuovere `finder-api` dal menu principale in `src/v2/ui/templates/navConfig.tsx`
- aggiungerlo come sotto-voce nella sezione Config/Settings
- mantenere route esistente `/v2/finder-api` (no breaking)

### 5. Audit "Gestione Mail" vs "Setting" — separazione + identità mailbox
**Problemi**:
- a UI viene mostrato "Luca Arcanà" loggato → ridondante, va tolto
- la mailbox mostrata nelle pagine email NON corrisponde all'utente loggato (mismatch sessione ↔ account IMAP/SMTP attivo)
- gestione mail e setting mailbox sono mescolati

**Fix**:
1. **UI header email**: sostituire "loggato come Luca Arcanà" con la **mailbox attiva** (es. `booking@tmwe.it`) + badge stato connessione IMAP.
2. **Audit binding mailbox ↔ user**: verificare in `useEmailAccounts` / `useActiveMailbox` (o equivalente) che la mailbox di default sia filtrata per `user_id = auth.uid()` e non globale. Identificare dove viene letta la mailbox sbagliata (probabile fallback su prima riga di `email_accounts` senza filtro utente).
3. **Separare** la pagina **Gestione Mail** (operativa: inbox, invio, regole) dalla pagina **Setting Mail** (config IMAP/SMTP, firme, alias). Spostare i pannelli di config fuori dall'inbox.
4. Aggiungere selettore mailbox esplicito quando l'utente ha più account, con persistenza in `localStorage` per-user.

### Ordine di esecuzione consigliato
1. Fix #1 (regressione bloccante WCA Partner)
2. Fix #2 (rapido, UI)
3. Fix #4 (rapido, navConfig)
4. Fix #3 (master-detail su 3 tab)
5. Fix #5 (audit mailbox + separazione gestione/setting — il più ampio)

### Nodi critici toccati
- `NetworkPage.tsx`, sidebar filtri WCA → solo selezione/propagazione, niente refactor logica filtri
- `navConfig.tsx` → spostamento voce, niente rimozione route
- Hook mailbox → audit read-only prima, poi fix mirato sul filtro `user_id`
- Nessun cambiamento DB / RLS / edge function in questo round

### Cosa NON tocco
- Pipeline approvazione WA/LI/email appena consolidata
- Edge functions, RLS, schemi DB
- Logica filtri esistente in NetworkPage (solo wiring click → selectedPartnerId)

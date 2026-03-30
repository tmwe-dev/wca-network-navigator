

# Cockpit Alimentato da Selezione Utente + Business Cards nel Network

## Problema attuale
Il Cockpit attualmente pesca direttamente dalla tabella `business_cards`, come se fosse una vista dedicata ai BCA. Sbagliato. Il flusso corretto e':

1. L'utente sta nel **Network**, vede i partner e i loro contatti
2. Seleziona quelli che vuole lavorare e clicca "Invia a Cockpit" o "Invia a Workspace"
3. Il **Cockpit** mostra SOLO quei contatti selezionati (un "batch" di lavoro)
4. I **Biglietti da visita** sono una sorgente aggiuntiva visibile nel Network, da cui l'utente puo' ugualmente selezionare e inviare al Cockpit

## Cosa cambia

### 1. Tabella `cockpit_queue` (nuova)
Serve un posto dove salvare "questi contatti sono stati inviati al cockpit". Campi:
- `id`, `user_id`
- `source_type` ("partner_contact" | "business_card" | "prospect_contact")
- `source_id` (uuid del record originale)
- `partner_id` (per contesto azienda)
- `created_at`
- `status` ("queued" | "worked")

### 2. Network: Azione "Invia a Cockpit"
Nella `UnifiedActionBar` (o `BulkActionBar`), aggiungere un pulsante "Cockpit" che prende i contatti dei partner selezionati e li inserisce in `cockpit_queue`.

### 3. Network: Business Cards visibili
Nel Network aggiungere una vista/tab "Biglietti da Visita" che mostra i BCA dell'utente. Da li' l'utente puo' selezionare e inviarli al Cockpit con la stessa azione.

### 4. Cockpit: legge da `cockpit_queue`
`useCockpitContacts` viene riscritto per leggere da `cockpit_queue` (join con `partner_contacts`, `business_cards`, o `prospect_contacts` in base a `source_type`). Mostra solo i record in coda, non piu' tutto il DB.

### 5. Workspace: stesso meccanismo
L'azione "Invia a Workspace" rimane separata ma usa lo stesso principio (gia' implementato tramite activities).

## File coinvolti

| File | Azione |
|------|--------|
| DB Migration | **Nuova tabella** `cockpit_queue` con RLS |
| `src/hooks/useCockpitContacts.ts` | Riscrivere per leggere da `cockpit_queue` + join sulle tabelle sorgente |
| `src/components/partners/UnifiedActionBar.tsx` | Aggiungere pulsante "Cockpit" |
| `src/pages/Cockpit.tsx` | Adattare per il nuovo data source (rimuovere logica BCA-only) |
| Network page (Operations/PartnerHub) | Aggiungere tab/sezione Business Cards selezionabili |


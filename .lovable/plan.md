

## Obiettivo
Verificare e correggere il sistema di invio LinkedIn (singolo + bulk) garantendo: (1) presenza obbligatoria del `linkedin_profile_url` come ID destinatario, (2) rispetto dei timing/rate-limit (max 3/ora già a DB), (3) UI per download/cattura ID profilo, (4) ricerca in tempo reale del profilo LinkedIn negli invii singoli.

## Audit fatto

**Backend già OK**:
- `send-linkedin/index.ts`: enforce 300 char, chiama `check_channel_rate_limit` (3/ora), accoda in `extension_dispatch_queue`
- `extension_dispatch_queue` + estensione browser per dispatch reale
- `multichannel-extension-architecture` memory: rate limit, TOS risk, dispatch queue

**Da verificare in lettura prima del fix**:
1. `LinkedInDMDialog` (singolo): accetta già un `recipient` con URL? È validato? Se manca URL, blocca o no?
2. `UnifiedBulkActionBar`: gap già noto — LinkedIn bulk non c'è (solo Email/WA). Per il bulk LI esiste solo `AgendaBulkBar`.
3. Esiste UI per: (a) catturare/incollare URL profilo LI sul contatto, (b) ricerca live profilo LI da nome+azienda?
4. Schema `partners` / `imported_contacts`: c'è la colonna `linkedin_url` o equivalente? Dove viene scritta?

## Piano di intervento

### Fase 1 — Audit completo (read-only, prima dei fix)
- Leggere `LinkedInDMDialog.tsx` e tutti i punti che lo invocano
- Cercare nel DB le colonne LinkedIn esistenti su `partners`, `imported_contacts`, `partner_contacts`
- Verificare se `useDirectContactActions` espone `handleSendLinkedIn`
- Cercare componenti di "ricerca LinkedIn live" (es. via `linkedin-search` edge function se esiste)
- Verificare flusso estensione: cosa serve in `recipient` (URL profilo? slug? entrambi?)

### Fase 2 — Hardening Singolo LI
- Validazione obbligatoria `linkedin_profile_url` prima della chiamata `send-linkedin`. Se assente → blocca + CTA "Aggiungi URL LinkedIn"
- Inline editor URL LinkedIn nel `LinkedInDMDialog` (paste rapido + validazione formato `linkedin.com/in/...`)
- Salvataggio URL sul contatto/partner al primo inserimento (così riusabile)

### Fase 3 — Ricerca LinkedIn live (singolo)
Se non esiste già:
- Pulsante "🔍 Cerca su LinkedIn" nel dialog → apre nuova tab con query Google `site:linkedin.com/in "<nome>" "<azienda>"`
- Opzionale (se edge function disponibile): chiamata a serper/google-search per restituire i primi 3 risultati cliccabili che auto-popolano l'URL
- Decisione: partiamo con la versione "open Google" zero-cost; la versione API solo se l'utente conferma

### Fase 4 — Bulk LinkedIn (gap noto)
- Aggiungere bottone "LinkedIn (X)" in `UnifiedBulkActionBar` (Network/CRM/BCA), abilitato solo per i contatti con `linkedin_profile_url` valorizzato
- Counter "Y/X pronti" + tooltip lista contatti senza URL
- Schedulazione rispettosa del rate limit (3/ora): batch viene messo in coda con `scheduled_for` distanziati di ≥21 min (3600/3 + buffer); riusa `extension_dispatch_queue` con `status='scheduled'`
- Reuse `linkedin-stealth-sync` rules: niente burst, niente pattern ritmico

### Fase 5 — UI per "download ID" (cattura URL profilo)
- Sul drawer contatto (CRM/BCA/Network): campo `linkedin_profile_url` editabile inline con icona LinkedIn
- Bottone "Apri profilo" che apre l'URL in nuova tab (verifica visiva dell'ID corretto)
- Estensione browser (già installata): aggiungere pulsante "Cattura URL profilo aperto" che invia l'URL al CRM via postMessage → salva su contatto. *Solo se il bridge estensione lo supporta già; altrimenti scope ridotto a copy/paste manuale.*

### Fase 6 — Verifica finale
- Smoke test: singolo LI con URL valido → coda OK
- Smoke test: singolo LI senza URL → bloccato con messaggio chiaro
- Smoke test: bulk 5 contatti → 5 record in `extension_dispatch_queue` con `scheduled_for` distanziati
- Verifica che `check_channel_rate_limit` continui a fare gate-keeping anche sul bulk

## Domande per l'utente

1. **Ricerca live LinkedIn**: preferisci versione zero-cost (apre Google in nuova tab) o versione API (Serper/Google Custom Search, richiede secret)?
2. **Cattura URL via estensione**: l'estensione browser attuale ha già un canale postMessage verso il CRM, o devo limitarmi al copy/paste manuale per ora?
3. **Bulk LI rate limit**: 3/ora è duro. Per un bulk da 50 contatti significa ~17 ore. Confermi che va bene distribuirli su più giorni rispettando notti, oppure vuoi un override "modalità manuale assistita" (l'utente clicca "Invia prossimo" ogni X minuti)?


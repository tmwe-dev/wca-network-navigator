

## Risposte rapide alle 3 domande

1. **Ricerca live**: zero-cost via Google. ✅ Scelta confermata.
2. **Estensione capture URL**: l'estensione **NON ha** ancora un'azione "leggi URL della tab attiva". Esiste solo `extractProfile(url)` che richiede già l'URL. Aggiunta possibile ma richiede modifica dell'estensione (out-of-scope di Lovable, è un binario separato). **Decisione**: per ora niente capture-from-tab. La ricerca Google + paste + auto-save è sufficiente.
3. **Bulk LI**: allineamento al pattern WhatsApp (delay secondi, non minuti) + rispetto orari notturni configurabili.

## Piano di implementazione

### Fase A — Skip ricerca se URL già presente
`LinkedInDMDialog`: nascondere il bottone "Cerca" quando `urlValid === true` all'apertura. Mostrare solo "Apri profilo" + edit URL.

### Fase B — Persistenza URL trovato
Quando l'utente trova/incolla un URL valido nel dialog (singolo), salvarlo automaticamente:
- Se `partnerId` presente → upsert in `partner_social_links` (platform=linkedin)
- Se `contactId` presente → upsert nel campo `enrichment_data.linkedin_profile_url` del contatto

Così la prossima volta non serve ricerca.

### Fase C — Setting orari operativi LinkedIn
Estendere `app_settings` con nuove chiavi (riusiamo lo stesso pattern di `agent_work_start_hour`):
- `linkedin_send_start_hour` (default 9)
- `linkedin_send_end_hour` (default 19)
- `linkedin_min_delay_seconds` (default 45)
- `linkedin_max_delay_seconds` (default 180)
- `whatsapp_min_delay_seconds` (default 4)
- `whatsapp_max_delay_seconds` (default 12)

UI: nuovo pannello in `Settings → Connections` (sezione "Timing invii multichannel") con 6 input numerici + preview "tempo stimato per N messaggi".

### Fase D — Bulk LI con timing tipo-WhatsApp
Riscrivere `useBulkLinkedInDispatch`:
1. Leggere settings (start/end hour, min/max delay) via `useAppSettings`
2. Per ogni messaggio: calcolare `scheduled_for = previous + random(min,max) seconds`
3. Se lo slot cade fuori dalla finestra → spostare al `start_hour` del giorno successivo
4. Aggiornare `BulkLinkedInDialog` con preview reale: "Ultimo invio: domani 14:32" invece di "~17h"

Nota sul rate limit DB (`check_channel_rate_limit` 3/ora): rimane attivo solo per invii **immediati**. Per il bulk con `scheduled_for` futuro lo bypassiamo (già implementato). L'utente è consapevole del rischio TOS e vuole timing più rapido.

### Fase E — Aggiornare memory
Aggiornare `mem://tech/communication/multichannel-extension-architecture`: i rate limits sono ora **configurabili da settings**, default conservativi ma override permesso (uso interno aziendale).

## File toccati
- `src/components/workspace/LinkedInDMDialog.tsx` — skip search se URL valido + auto-save
- `src/hooks/useBulkLinkedInDispatch.ts` — random delay + finestra oraria
- `src/components/workspace/BulkLinkedInDialog.tsx` — preview ora effettiva
- `src/components/settings/ConnectionsSettings.tsx` (o nuovo `MultichannelTimingSettings.tsx`) — UI 6 setting
- `src/lib/multichannelTiming.ts` (nuovo) — utility `nextSendSlot(prevSlot, settings)` riusabile

## Out-of-scope (richiede lavoro separato)
- Capture URL dalla tab attiva (richiede modifica all'estensione browser, non al webapp)
- Modifica dei delay WhatsApp esistenti (solo lettura settings, cambio comportamento bulk WA non richiesto qui)


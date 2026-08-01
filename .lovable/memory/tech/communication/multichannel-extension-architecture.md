---
name: Multichannel Extension Architecture
description: WA/LI invio e ricezione via browser extension; rate limits configurabili da app_settings (timing per canale)
type: feature
---
WhatsApp e LinkedIn usano esclusivamente il bridge dell'estensione browser (no API ufficiali). Rischio TOS documentato.

## Timing dispatch bulk (configurabile)
Le chiavi `app_settings` per canale:
- `linkedin_send_start_hour` / `linkedin_send_end_hour` (default 9 / 19)
- `linkedin_min_delay_seconds` / `linkedin_max_delay_seconds` (default 45 / 180)
- `whatsapp_send_start_hour` / `whatsapp_send_end_hour` (default 8 / 21)
- `whatsapp_min_delay_seconds` / `whatsapp_max_delay_seconds` (default 4 / 12)

UI di configurazione: Settings → Connessioni → "Timing invii multichannel" (`MultichannelTimingPanel`).

## Logica scheduling
`src/lib/multichannelTiming.ts` espone `parseTimingFromSettings`, `buildSchedule`, `nextSendSlot`, `clampToWindow`, `estimateBatchDuration`. Il bulk pre-calcola tutti gli slot con delay random (min..max sec) e sposta automaticamente al giorno successivo se fuori finestra.

## Rate limit DB
`check_channel_rate_limit` (LI: 3/h, WA: 5/min) si applica solo agli invii **immediati**. Il bulk con `scheduled_for` futuro lo bypassa: l'estensione legge la coda `extension_dispatch_queue` solo quando lo slot è scaduto, quindi il timing impostato nei settings è il vero gate.

## ID destinatario LinkedIn obbligatorio
Ogni invio LI richiede `linkedin.com/in/...` valido. `LinkedInDMDialog` valida formato, salta la ricerca se l'URL è già presente, e auto-salva l'URL trovato/incollato in `partner_social_links` (se partnerId) o `imported_contacts.enrichment_data.linkedin_profile_url` (se contactId). Ricerca live: zero-cost via `useLinkedInLookup` (Google fallback in nuova tab).

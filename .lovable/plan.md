# LinkedIn — Fase A+B applicata (2026-05-07)

## Cosa è stato fatto

### Migration DB
- Dedup di tutte le righe duplicate in `app_settings`.
- Nuovo vincolo `app_settings_key_unique (key)` per impedire futuri duplicati.
- Nuove chiavi:
  - `linkedin_auto_sync_enabled = true`
  - `linkedin_read_times_per_day = 3`
  - `linkedin_read_start_hour = 9`
  - `linkedin_read_end_hour = 19`

### Fase A — DAL + cursor
- `src/data/channelMessages.ts`: aggiunto `getLastInboundOrOutboundForContact()`.
- `src/hooks/useLinkedInBackfill.ts`: rimosse 2 violazioni DAL (`supabase.from("channel_messages")` diretto) → ora passa per `upsertChannelMessageDedup` + `getLastInboundOrOutboundForContact`.
- `src/hooks/useLinkedInSync.ts`: refactor con cursor per-contatto via `getChannelContactCursors`. Filtri ghost-body (foto/video/audio) ed etichette UI ("Da leggere", "Tutti", ...) applicati. Nuovo argomento `silent` per le letture automatiche. Emette `li-sync-completed`.

### Fase B — Auto-sync LENTO governato da DB
- `src/hooks/useLinkedInAutoSync.ts` (nuovo): pianifica N letture/giorno (default 3) in slot pseudo-random distribuiti uniformemente nella finestra `9-19`, con jitter ±20 min. Persistenza `localStorage`. Guard: paused, isAvailable, tab visibile, single-flight, no-op se ultima sync < 30 min fa. Trigger manuale via evento `li-sync-trigger`.
- `src/v2/ui/templates/BackgroundServices.tsx`: monta `useLinkedInAutoSync({ paused: nightPause })` accanto a quello WhatsApp.

## Cosa NON è stato fatto (rimandato)

- Fase C (Chat Mode): **scartato** per scelta utente — su LinkedIn non si chatta in real-time.
- Fase D (header button + indicator): non urgente, fattibile dopo verifica.
- Fase E hardening: pausa notturna su backfill, audit Optimus.

## Come modificare la cadenza

UI Settings → cerca chiavi `linkedin_read_times_per_day` (1-6), `linkedin_read_start_hour`, `linkedin_read_end_hour`, oppure `linkedin_auto_sync_enabled = false` per spegnere tutto.

---
name: LinkedIn Slow Auto-Sync
description: Auto-sync LinkedIn LENTO 2-3 letture/giorno governato da app_settings; cursor per-contatto; no Chat Mode
type: feature
---
LinkedIn ha detection anti-bot più aggressiva di WhatsApp: NON usare cadenza a minuti come WA.

- `useLinkedInAutoSync` pianifica N slot/giorno random nella finestra operativa, governati da `app_settings`:
  - `linkedin_auto_sync_enabled`, `linkedin_read_times_per_day` (default 3), `linkedin_read_start_hour` (9), `linkedin_read_end_hour` (19).
- `useLinkedInSync.readNow(silent?)` usa cursor per-contatto via `getChannelContactCursors` + filtri `LI_UI_LABELS`/`LI_GHOST_BODIES`. Emette `li-sync-completed`.
- Trigger manuale: evento `li-sync-trigger`.
- Mount: `BackgroundServices` → `useLinkedInAutoSync({ paused: nightPause })`.
- DAL: tutte le scritture/letture passano da `src/data/channelMessages.ts` (no `supabase.from("channel_messages")` in hook).
- Decisione: NESSUN Chat Mode su LinkedIn.
- `app_settings` ha UNIQUE su `key` (constraint `app_settings_key_unique`).

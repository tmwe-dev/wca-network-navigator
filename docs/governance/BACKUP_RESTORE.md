# Backup & Restore

## Backup automatici (Lovable Cloud)
- DB: snapshot daily, retention 7gg (Free) / 30gg (Pro).
- Storage: redundant.
- Edge function code: in repo Git.

## Backup applicativo aggiuntivo
- `ai-backup` edge function: dump JSON tabelle critiche (prompt, KB, personas) → bucket storage privato.
- Schedule: weekly via pg_cron.

## Restore
1. **Tabella business**: ripristino selettivo via SQL da snapshot (read-only restore in clone, poi `INSERT ... ON CONFLICT DO NOTHING`).
2. **Prompt/KB/Personas**: import JSON da bucket via UI Prompt Lab "Import".
3. **Full DB**: contattare Supabase support (Lovable Cloud disabling non disponibile).

## Test restore
Trimestrale: restore tabella `operative_prompts` in clone, verifica integrità FK.

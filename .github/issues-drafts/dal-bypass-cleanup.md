# Debito tecnico: bypass del Data Access Layer

**Data audit:** 2026-04-19
**Scope:** 581 errori ESLint `no-restricted-syntax` per uso diretto di `supabase.from()` fuori da `src/data/**`.

## Contesto

La regola architetturale [`mem://architecture/data-access-layer-dal`](../../../) impone che ogni query Supabase passi dal modulo DAL in `src/data/`. Attualmente molti hooks/components bypassano la regola con chiamate dirette al client.

## Stato

- **Severità:** medio-bassa (non blocca build, non blocca produzione)
- **Regola attuale:** `warn` (non `error`) — la CI passa
- **Volume:** 581 violazioni in ~150 file
- **Effort stimato:** ~2 settimane di lavoro meccanico

## Piano di rientro proposto

Migrazione progressiva, **10 file/sprint**, prioritizzata per:

1. File con più di 5 chiamate dirette (alto impatto refactor)
2. Hook condivisi (`src/hooks/`) — riusati da molti componenti
3. Componenti V2 (`src/v2/**`) — codice attivo
4. Tutto il resto

## Comando per inventario aggiornato

```bash
npx eslint src --rule '{"no-restricted-syntax":"error"}' --format json \
  | jq -r '.[] | select(.errorCount > 0) | "\(.errorCount)\t\(.filePath)"' \
  | sort -rn | head -20
```

## Decisione

NON affrontato in questo audit (2026-04-19): ROI basso, rischio regression alto, nessun impatto sicurezza dato che le RLS server-side proteggono comunque i dati. Tracciato qui per visibilità.

# V2 Migration Status

> Aggiornato: 2026-05-31. La migrazione delle pagine v1 → v2 è **completata**.

## Stato attuale

- `src/pages/` **non esiste più**: tutte le pagine sono native sotto `src/v2/ui/pages/`.
- Nessun file in `src/v2/` importa più da `@/pages/*` (guardrail ESLint attivo
  in `eslint.config.js`, blocco "V2 migration guardrail").
- Il residuo legacy non è più a livello di _pagina_ ma a livello di _componenti
  di feature_ in `src/components/*` (es. `acquisition/`, `campaigns/`,
  `cockpit/`, `email/`, `operations/`): le pagine v2 li compongono. Questi NON
  sono codice morto — sono l'implementazione attiva e vanno migrati per dominio,
  non in blocco, per non rompere i nodi critici.

## Cosa resta (debito tracciato)

1. **Layer enforcement** (`docs`/`eslint.config.js`): promozione progressiva da
   `warn` a `error` delle regole component→DAL e `supabase.from` diretto.
   - ✅ hook→component: già a `error` (tipi spostati in `src/types/`).
   - ⏳ component→DAL: bonifica per cartella, poi `error`.
   - ⏳ `supabase.from` diretto fuori dal DAL: rimozione progressiva degli
     `ignores`.
2. **Assorbimento componenti di feature** in `src/v2/ui/organisms` quando un
   dominio viene riscritto in modalità v2 logic-less.

## Nota

I draft `v2-migration-batch-1/2/3.md` in `.github/issues-drafts/` sono
**superati**: descrivevano wrapper su `src/pages/` che non esistono più.

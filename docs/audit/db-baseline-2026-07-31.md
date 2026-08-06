# BATCH 7 — Baseline database (READ-ONLY, 2026-07-31)

Nessuna migrazione applicata, nessuna modifica a RLS, permessi o dati.
Tutte le verifiche sono state eseguite con sole query di lettura.

## 1. Schema e tipi generati — drift

| Oggetto               |  DB | `src/integrations/supabase/types.ts` | Drift                        |
| --------------------- | --: | -----------------------------------: | ---------------------------- |
| Tabelle base `public` | 216 |                                  216 | **0** (diff per nome: vuoto) |
| View `public`         |  14 |                                   14 | **0** (diff per nome: vuoto) |

I tipi generati sono allineati allo schema: nessuna tabella/view mancante o
in eccesso. (`types.ts` espone 52 signature di funzione: sottoinsieme RPC atteso,
non indice di drift.)

## 2. Postura di sicurezza rilevata (sola lettura)

| Check                                                          | Valore |
| -------------------------------------------------------------- | -----: |
| Tabelle `public` senza RLS abilitata                           |  **0** |
| View `public` ancora SECURITY DEFINER (`security_invoker` off) |      2 |
| Funzioni applicative `public` senza `search_path` esplicito    |      2 |

Le funzioni senza `search_path` sono esattamente:
`public.normalize_company_name(name text)` e `public._cron_invoke_edge_sql(fn_name text)`.
Le view interessate sono `public.funnemail_jobs_v` e `public.v_kb_active_canonical`.
Coincidono 1:1 con lo scope delle migrazioni pending: **nessun drift** rispetto
a quando sono state scritte, e nessun oggetto nuovo entrato nello scope.

## 3. Migrazioni pending — validazione statica (NON applicate)

Cartella `supabase/migrations-pending/` — 2 fix + 2 rollback, stato CREATE-ONLY.

| File                                         | Statement | Dollar-quote bilanciati | Parentesi bilanciate | DDL distruttivo / RLS / dati                  |
| -------------------------------------------- | --------: | ----------------------- | -------------------- | --------------------------------------------- |
| `20260730_01_fix_function_search_path.sql`   |        11 | sì                      | sì                   | nessuno                                       |
| `20260730_01_...rollback.sql`                |         2 | sì                      | sì                   | nessuno                                       |
| `20260730_02_fix_security_definer_views.sql` |        17 | sì                      | sì                   | nessuno (`GRANT` compare solo in un commento) |
| `20260730_02_...rollback.sql`                |         2 | sì                      | sì                   | nessuno                                       |

Verifica delle **preflight assertion contro lo stato reale del DB** (read-only):

| Assertion                                     | Atteso | Reale | Esito |
| --------------------------------------------- | ------ | ----- | ----- |
| `_cron_invoke_edge_sql(text)` esiste          | true   | true  | ok    |
| `normalize_company_name` è IMMUTABLE          | `i`    | `i`   | ok    |
| `idx_partners_company_name_normalized` valido | true   | true  | ok    |
| Colonne `funnemail_jobs_v`                    | 22     | 22    | ok    |
| Colonne `v_kb_active_canonical`               | 11     | 11    | ok    |

Tutte le preflight passerebbero oggi; le migrazioni restano **non applicate** e
richiedono autorizzazione esplicita. Impatto semantico da valutare prima
dell'applicazione: con `security_invoker = true` le RLS delle tabelle sottostanti
vengono valutate con l'identità del chiamante (vedi nota nel file 02).

## 4. Nessuna correzione SQL necessaria

Gli SQL pending sono già idempotenti, con preflight/postflight e rollback
dedicato: nessuna correzione richiesta in questo batch.

# Baseline duplicazione identità e confini dati — 2026-08-09

Misurazione read-only. Nessuna modifica a dati, schema o RLS.

## Duplicazione identità

| Metrica                                                        | Valore                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Email duplicate dentro `partner_contacts`                      | 25.933 su 26.452 distinte                                                                                |
| Email `imported_contacts` presenti anche in `partner_contacts` | 1.274                                                                                                    |
| Rappresentazioni concorrenti di "Contact"                      | 4+ (`partner_contacts`, `imported_contacts`, `business_cards`, `linkedin_addresses`/`prospect_contacts`) |

Comando: `node scripts/audit-identity-duplicates.mjs --sql`

## Confini di modulo

| Contatore                             | Valore         |
| ------------------------------------- | -------------- |
| Cicli legacy → `@/v2`                 | 51             |
| Accessi DB fuori dal DAL              | 122            |
| Import v2 → legacy verticale          | 667            |
| Accessi a tabelle owned fuori dal DAL | 1 (`partners`) |

Comando: `node scripts/audit-module-boundaries.mjs`

## Nota

Il contatore "tabelle owned fuori dal DAL" è basso perché quasi tutto l'accesso client passa
già da `src/data` / `src/v2/io`. Il vero accoppiamento residuo è lato Edge Functions
(`supabase/functions/_shared/platformTools*`), da misurare in un batch successivo.

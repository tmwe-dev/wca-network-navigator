# COMPLEXITY_AUDIT.md — sintesi profonda

Base HEAD: `9bfcb627ce574a78cc67ecd34e4444c2507baeb9` (delta vs richiesta: 2 commit non-runtime — vedi AUDIT_METHOD.md).

## Numeri chiave

- **File tracciati**: 4130
- **Byte totali**: 51,304,029
- **Righe totali**: 545,596
- **File testuali**: 3963 / **binari**: 167
- **Scope semantico**: 3445 file / 426,729 righe
- **Test-to-runtime ratio (righe)**: 0.135 (test 50,673 / runtime 376,056)
- **Edge Functions**: 154
- **DB migrations**: 416 file / 25,186 righe

## Distribuzione dimensioni (righe per file, scope semantico)

| bucket    | files |
| --------- | ----- |
| <50       | 969   |
| 50-200    | 1807  |
| 200-500   | 631   |
| 500-1000  | 37    |
| 1000-2000 | 1     |

## Righe per area

| area           | files | lines  | bytes    |
| -------------- | ----- | ------ | -------- |
| src_components | 725   | 109197 | 4542575  |
| src_v2         | 823   | 105085 | 4114175  |
| edge_functions | 337   | 55717  | 2146706  |
| src_other      | 204   | 39581  | 9175831  |
| public_asset   | 265   | 32004  | 10350084 |
| edge_shared    | 215   | 31176  | 1112183  |
| src_hooks      | 216   | 27396  | 1034521  |
| other          | 28    | 25755  | 13563817 |
| db_migrations  | 416   | 25186  | 1190832  |
| archive        | 107   | 25132  | 1025998  |
| src_data       | 264   | 24464  | 941711   |
| docs_memory    | 217   | 19095  | 1150612  |
| src_lib        | 149   | 14049  | 543758   |
| test_e2e       | 85    | 5786   | 218241   |
| src_support    | 25    | 1857   | 59123    |
| src_state      | 9     | 1067   | 36105    |
| scripts        | 13    | 1025   | 33042    |
| build_config   | 13    | 965    | 30853    |
| ci_config      | 15    | 651    | 21031    |
| src_pages      | 1     | 162    | 5504     |
| lint_rules     | 2     | 134    | 4612     |
| supabase_other | 1     | 112    | 2715     |

## Debito aggregato (scope semantico)

| metrica                               | valore |
| ------------------------------------- | ------ |
| total_any                             | 977    |
| total_ts_ignore                       | 0      |
| total_todo                            | 13     |
| total_fixme                           | 1      |
| total_deprecated                      | 32     |
| total_eslint_disable                  | 92     |
| total_console                         | 527    |
| supabase_from_bypass_files_out_of_dal | 80     |
| supabase_from_bypass_total_hits       | 185    |

## Findings (14 regole strutturali, 608 finding totali)

### Per severità

| severity |
| -------- |
| high     |
| info     |
| low      |
| medium   |

| severity | count |
| -------- | ----- |
| medium   | 306   |
| high     | 262   |
| low      | 27    |
| info     | 13    |

### Per codice regola

| code                   | count |
| ---------------------- | ----- |
| LONG_FUNCTION          | 165   |
| DEEP_NESTING           | 117   |
| DAL_BYPASS             | 82    |
| MANY_ANY               | 67    |
| V1_V2_BASENAME_OVERLAP | 45    |
| SIZE_MEDIUM_FILE       | 37    |
| MANY_CONSOLE           | 27    |
| CYCLO_MEDIUM           | 25    |
| DEPRECATED_MARK        | 13    |
| NEAR_DUPLICATE         | 9     |
| EXACT_DUPLICATE        | 8     |
| ESLINT_DISABLE         | 6     |
| CYCLO_HIGH             | 6     |
| SIZE_LARGE_FILE        | 1     |

## Orfani (candidati, non conferme)

- **473 candidate** con 0 importer statici in `src/`. Richiede verifica manuale (route string, lazy import, riferimenti runtime).
- **Falsi orfani noti da doctrine**: file lazy-caricati via `React.lazy`, edge functions invocate via string, componenti registrati in barrel non tracciati.

## Duplicati

- **8 cluster** con SHA1 identico (contenuto byte-per-byte uguale).
- **9 cluster** con fingerprint identico (primi 8k normalizzati) ma SHA1 diverso.

## Overlap v1/v2

- **45 file** in `src/v2/` con **stesso basename** in `src/` non-v2. Segnale (non prova) di duplicazione: alcuni sono legittimamente separati (wrapper/adapter), altri sono candidati a consolidamento.

## Edge Functions

- **154 functions** in `supabase/functions/`.
- **16 gruppi** con >=3 function che condividono prefisso — indicano famiglie funzionali con potenziale duplicazione di boilerplate (auth guard, CORS, error shape).

## Rischi cross-cutting (osservazioni verificate staticamente)

1. **DAL bypass**: 82 file fuori DAL usano `supabase.from()` direttamente (185 hit totali) — coerente con memoria progetto (bypass ridotti ma ancora presenti).
2. **`any` sparsi**: 977 occorrenze totali; 67 file oltre soglia (>=5) → concentrazione in hooks/services v1.
3. **`console.*` in runtime**: 527 hit, 27 file oltre soglia — viola standard `createLogger` (memoria attiva).
4. **Nesting >=8**: 117 file → segnala funzioni monster (spesso stessi file dei LONG_FUNCTION).
5. **Test coverage LOC ratio 0.135** → basso per un'app di questa scala; ampio hotspot non testato tra i top-file per dimensione.

## Contraddizioni & sovrapposizioni concrete (P0 candidate)

- 8 duplicati esatti + 9 near-dup → target sicuro di dedup.
- V1/V2 overlap 45 basename → richiede triage 1-a-1 (non tutti sono duplicati logici).
- Migrations 416 file / 25k righe → superficie SQL rilevante; consolidamento _vietato_ in P0 ma auditabile.

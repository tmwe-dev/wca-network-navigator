# Type Safety — Baseline riproducibile (2026-07-31)

Base commit: `f1108a6f9312d3dc54857a4f2afb4008340f061b`

## Comando unico e perimetro fisso

```bash
node scripts/ts-safety-metrics.mjs --top
```

Perimetro (`scripts/ts-safety-metrics.mjs`): tutti i `.ts`/`.tsx` sotto `src/`,
esclusi `*.test.*`, `*.spec.*`, `*.d.ts`, `src/test/**`, `**/__tests__/**`,
`node_modules`, `dist`, `coverage`. Totale file misurati: **2107**.

## Baseline (prima del batch)

| Metrica                                             | Valore |
| --------------------------------------------------- | ------ |
| `untypedFrom(`                                      | 149    |
| `as never`                                          | 135    |
| `as unknown as`                                     | 313    |
| any esplicito (`: any`, `<any>`, `as any`, `any[]`) | 20     |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`   | 0      |
| `eslint-disable`                                    | 71     |

Nota: la misura precedente di 157 `untypedFrom` includeva anche i file di test
(`src/test/calendar.test.ts`, `src/test/rbac.test.ts`), qui esclusi dal perimetro.

## Drift schema documentato (non migrabile senza inventare schema)

- `ra_prospects`, `ra_contacts`, `ra_interactions`, `ra_scraping_jobs` — assenti dai tipi generati.
- `funnemail_eval_dataset`, `funnemail_eval_batch_runs` — assenti dai tipi generati.
- `user_roles.role_id`, `user_roles.assigned_by` — colonne assenti nei tipi generati
  (presenti nella migrazione `20260422180200_lovable102_rbac.sql`).
- `team_members.team_id`, `team_members.user_id`, `team_members.joined_at` — idem.
- `teams` — tabella assente nei tipi generati.

Per questi casi resta `untypedFrom` con adapter minimo **validato a runtime**
(`parseRole`, `parseTeamMember` in `src/data/rbac.ts`): nessuna asserzione di tipo.

# Reality Check — 2026-04-14

Verified metrics from codebase scan. All numbers produced by automated commands.

## Codebase Metrics

| Metric | README claim | Verified value | Command |
|---|---|---|---|
| Edge Functions | 76 | **77** | `ls supabase/functions/ \| wc -l` |
| Unit test files | 183+ | **183** | `find src -name "*.test.*" \| wc -l` |
| E2E spec files | 28 | **32** | `find e2e -name "*.spec.*" \| wc -l` |
| Total test files | — | **234** | `find src supabase e2e -name "*.test.*" -o -name "*.spec.*" \| wc -l` |
| Files > 500 lines | — | **3** | `find src -name "*.ts*" \| xargs wc -l \| awk '$1>500' \| wc -l` (excl. total) |
| useNavigate / Navigate refs | — | **66** | `grep -rn "useNavigate\|<Navigate " src/ \| wc -l` |

## README Corrections Needed

| Line | Current | Correct |
|---|---|---|
| L35 | "76 Edge Functions" | "77 Edge Functions" |
| L101 | "28 spec" | "32 spec" |

## Notes

- Test count "1500+ test case" not independently verified (would require running full suite).
- "47 tool AI" count not verified in this pass.

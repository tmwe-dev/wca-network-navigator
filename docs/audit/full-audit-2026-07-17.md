# Audit Completo — 2026-07-17

> Misure raccolte con: Playwright (sessione TMWE reale, viewport 1280×1800),
> `tsgo --noEmit`, `bunx eslint`, `supabase.slow_queries`, `supabase.linter`,
> `security.get_scan_results`, `ai_gateway_logs.list`, ripgrep sul repo.
> Nessuna modifica di codice in questo audit.

---

## 1. Funzionalità

### Misure (Playwright su 15 voci menu)

| Voce | Route | H1 | Btn | Console err | Net 4xx | Net 5xx | Esito |
|---|---|---|---:|---:|---:|---:|---|
| Command | `/v2/command` | ❌ nessun H1 | 11 | 2 (CSP) | 0 | 0 | 🟡 |
| Missioni | `/v2/agents/autopilot` | ✅ "Missioni Autopilot" | 11 | 2 | 0 | 0 | 🟢 |
| Vendi | `/v2/explore/network` | ❌ | 214 | 2 | 0 | 0 | 🟡 |
| Autorizza | `/v2/cestinone` | ✅ "Autorizza" | 13 | 3 | **1** | 0 | 🟡 |
| Cockpit | `/v2/cockpit` | ❌ | 30 | 2 | 0 | 0 | 🟡 |
| Agenda | `/v2/agenda` | ❌ | 95 | 2 | 0 | 0 | 🟡 |
| Comms | `/v2/comms` | ✅ "Comunicazioni" | 67 | **8** | **6** | 0 | 🟡 |
| Leggi | `/v2/inbox` | ❌ | 71 | **10** | **6** | 0 | 🟡 |
| Scrivi | `/v2/email` | ✅ "Scrivi" | 28 | 2 | 0 | 0 | 🟢 |
| Funnemail | `/v2/funnemail-inbox` | ✅ "Funnemail" | 15 | 2 | 0 | 0 | 🟢 |
| Rubrica WA | `/v2/whatsapp-addresses` | **404** | 10 | 2 | 0 | 0 | 🔴 |
| Rubrica LI | `/v2/linkedin-addresses` | **404** | 10 | 2 | 0 | 0 | 🔴 |
| Agenti | `/v2/intelligence/agents` | ❌ | 30 | 2 | 0 | 0 | 🟡 |
| Lab | `/v2/prompt-lab` | ✅ "Lab & Verifiche" | 26 | 2 | 0 | 0 | 🟢 |
| Config | `/v2/settings` | ❌ | 10 | 2 | 0 | 0 | 🟡 |

### Findings
- 🔴 **2 rotte del menu ritornano 404** (WA/LI addresses) — voci morte.
- 🟡 **7 pagine senza `<h1>` semantico** (Command, Vendi, Cockpit, Agenda, Leggi, Agenti, Settings) — regressione rispetto al P0 dell'audit precedente: `PageTitleHeader` è stato adottato solo su 22/91 pagine.
- 🟡 **Comms e Leggi** — 6 chiamate 4xx e 8-10 errori console: probabilmente ancora CORS `manage-email-folders`.
- ✅ Nessun 500 su tutte le pagine testate.
- ✅ Tutti gli errori console non-CSP sono ≤ 10 e non bloccano il render.

### Voto — Funzionalità

Base 100.000, decurtazioni:
- −5.000 × 2 pagine 404 = −10.000
- −1.500 × 7 pagine senza H1 = −10.500
- −1.500 × 3 pagine con 4xx significativo = −4.500

**F = 75.000 / 100.000**

---

## 2. Pulizia codice

### Misure

| Metrica | Valore |
|---|---:|
| File TS/TSX | 2.310 |
| TypeScript errori (`tsgo --noEmit`) | **0** ✅ |
| ESLint errori | **257** |
| ESLint warning | 0 |
| `any` / `as any` occorrenze | 683 |
| `@ts-ignore` / `@ts-expect-error` | 0 ✅ |
| TODO/FIXME/HACK | 14 |
| `console.log/warn/error` residui | 18 |
| Pagine con `StandardPageFrame` | **2 / 91** (2%) |
| Pagine con `PageTitleHeader` | **22 / 91** (24%) |
| Import `queryKeys` | 274 file (su 413 `useQuery`) = **66%** centralizzati |
| File in `archive/` ancora nel repo | 107 |

### Findings
- ✅ **Zero errori TypeScript** — invariante rispettata (tsgo pulito).
- 🔴 **257 errori ESLint bloccanti** (`eqeqeq`, `no-useless-escape`, `no-control-regex`, ecc.): il gate qualità non blocca il commit.
- 🟡 **683 `any` sparsi**: debito sostanziale nonostante zero `@ts-ignore`.
- 🟡 **SSOT guscio ignorato**: solo 2 pagine su 91 usano `StandardPageFrame`. La regola "guscio uniforme" è di fatto disattesa; l'audit precedente ha allineato solo 5 pagine.
- 🟡 **107 file in `archive/`**: rumore nel repo, aumentano il tempo di grep/IDE.
- 🟡 **34% delle `useQuery` non passa da `queryKeys.ts`** → chiavi libere = invalidation frammentata.
- 🟢 18 `console.*` residui: limite basso, gestibile.

### Voto — Pulizia

Base 100.000, decurtazioni (cap −15.000 su `any` per non annullare l'asse):
- ESLint 257 errori × −100 = −25.700
- `any` 683 × −50 con cap = −15.000
- 14 TODO × −50 = −700
- 18 `console.*` × −100 = −1.800
- 107 file archive nel repo = −2.000
- SSOT `StandardPageFrame` su 2/91 pagine = −5.000
- `PageTitleHeader` solo su 24% pagine = −3.000
- Rotte duplicate/redirect (funnemail_inbox, intelligence) = −1.000

**P = 45.800 / 100.000**

---

## 3. Leggerezza infrastruttura

### Misure DB (7 giorni)

| Query | Chiamate | Media | Max | Totale |
|---|---:|---:|---:|---:|
| `cron_job_status()` | 9.362 | **1.334 ms** | 7.779 ms | **12.496 s** (3h28m CPU) |
| `partner_contacts WHERE email ILIKE` | 28.409 | 317 ms | 7.948 ms | 9.033 s |
| `partners WHERE email ILIKE` | 29.450 | 205 ms | 7.891 ms | 6.052 s |
| `partners WHERE lead_status = ANY` | 9.152 | 497 ms | 7.783 ms | 4.554 s |
| `partner_contacts email ILIKE (bis)` | 4.309 | 905 ms | 7.688 ms | 3.900 s |
| `imported_contacts email ILIKE` | 18.172 | 201 ms | 7.686 ms | 3.664 s |

### Backend

| Metrica | Valore |
|---|---:|
| Tabelle pubbliche | 197 |
| Migrations totali | **408** |
| Migrations ultimi ~30g | 20 |
| Edge functions | **150** (3.3 MB sorgente) |
| Supabase linter — issues totali | **274** |
| Supabase linter — ERROR (Security Definer View, ecc.) | ≥ 2 |
| Security scan — findings aperti | ≥ 3 (leaked-password OFF, info leakage edge, ecc.) |
| AI Gateway calls (7g) | 0 (BYOK OpenAI diretto — bypassa gateway) |

### Findings
- 🔴 **`cron_job_status()` è ancora la query più pesante**: 9.362 chiamate in 7 giorni con media 1.3 s. L'ottimizzazione di ieri ha ridotto i timeout ma il polling top-bar la chiama a raffica. Va **cachizzata client-side** (≥ 60 s) o rimossa dal render iniziale.
- 🔴 **Indici mancanti su `email` con `ILIKE`**: 4 delle 6 query top scansionano `partner_contacts.email`, `partners.email`, `imported_contacts.email` con `ILIKE` senza indice trigram (`pg_trgm gin_trgm_ops`). Impatto cumulato: **26.649 s** (7h24m) di CPU su 7g.
- 🟡 **408 migrations** accumulate: costo su ogni `db reset`/branch; da consolidare periodicamente.
- 🟡 **150 edge functions**: superficie molto ampia; alcune sono chiaramente duplicate o legacy (WA/LI proxy variants).
- 🟡 **274 issue linter Supabase** con almeno 2 ERROR di livello sicurezza (Security Definer View).
- 🟢 AI Gateway 0 calls → BYOK OpenAI attivo, coerente con l'architettura documentata.

### Voto — Infrastruttura

Base 100.000, decurtazioni:
- 6 slow query > 500 ms × −300 = −1.800
- `cron_job_status` polling out-of-control = −5.000
- Indici trigram mancanti su email (3 tabelle) = −3.000
- 150 edge functions (superficie) = −2.000
- 408 migrations accumulate = −1.500
- 274 linter issues + 2 ERROR SECURITY DEFINER = −5.000
- Password leaked-protection OFF = −500

**I = 81.200 / 100.000**

---

## Voto complessivo

Media pesata **0.40 × F + 0.35 × P + 0.25 × I**:

```
0.40 × 75.000 + 0.35 × 45.800 + 0.25 × 81.200
= 30.000    +   16.030      +   20.300
= 66.330
```

### **Voto totale: 66.330 / 100.000**

| Asse | Peso | Voto | Contributo |
|---|---:|---:|---:|
| Funzionalità | 40% | 75.000 | 30.000 |
| Pulizia codice | 35% | 45.800 | 16.030 |
| Infrastruttura | 25% | 81.200 | 20.300 |
| **Totale** | 100% | | **66.330** |

Interpretazione: **funzionalità solida ma non completa**, **infrastruttura sostanzialmente sana con 2-3 emorragie note**, **codice funzionante ma disciplinato solo a metà** (TS pulito, ma ESLint ignorato, SSOT guscio non applicato, `any` diffusi).

---

## Top 10 azioni di rientro (ordine impatto/effort)

| # | Azione | Asse | Impatto atteso | Effort |
|---:|---|---|---|---|
| 1 | Registrare o rimuovere le rotte `/v2/whatsapp-addresses` e `/v2/linkedin-addresses` (o correggere il menu) | F | +10.000 | 1 h |
| 2 | Aggiungere indici trigram `pg_trgm` su `email` di `partners`, `partner_contacts`, `imported_contacts` | I | +3.000, taglio ~7h CPU/settimana | 30 min |
| 3 | Cachizzare `cron_job_status()` in client (staleTime 60 s) o spostarlo dietro un `enabled: isAdmin` | I | +5.000, meno drift top-bar | 1 h |
| 4 | Fix CORS `manage-email-folders` per chiudere i 4xx su `/v2/inbox` e `/v2/comms` | F | +3.000 | 30 min |
| 5 | Aggiungere `PageTitleHeader` (H1 semantico) alle 7 pagine senza titolo | F | +10.500 | 2 h |
| 6 | `eslint --fix` sui 7 fixable + fix manuale dei 250 `eqeqeq`/regex | P | +25.700 | 2 h |
| 7 | Spostare `archive/` fuori dal repo (submodule o branch dedicato) | P | +2.000, meno rumore IDE | 20 min |
| 8 | Consolidare le migrations pre-2026-04 in un baseline | I | +1.500 | 4 h |
| 9 | Chiudere le 2 SECURITY DEFINER VIEW segnalate dal linter Supabase | I | +2.000, chiude ERROR | 1 h |
| 10 | Bonifica `any` in DAL (`src/data/*`) — target `-100` occorrenze | P | +5.000 | 4 h |

Fatte le prime 5 azioni (~5 h): il voto salirebbe stimato a **~85.000 / 100.000**.

---

*Audit chiuso 2026-07-17, ore 11:29 UTC. Nessun file di codice modificato in questo audit.*

# Piano: riveste Funnemail con la grafica del prototipo, zero logica toccata

## Principio guida
- **Logica V2 invariata**: hook, DAL, edge function, RLS, query keys, journalistReview, claim system, sorting queue, Scout/Brain/Jobs/Eval/Simulator → nessun cambio funzionale.
- **Solo "pelle nuova"**: layout, classi, token, asset, micro-interazioni dal prototipo `funnemail-sorgenti-20260518-1751.zip`.
- Le 7 maschere "tecniche" (Scout Cache, Job Ledger, Eval, Operations, Brain, Routing Rules, Simulator) restano dove sono ma non si vedono dentro Funnemail: vengono **spostate a livello di navigazione** in Settings/Analytics.

---

## Fase 1 — Estrazione design system dal prototipo

Da `/tmp/funnemail-proto/style.css` estraggo e porto in V2:
- Palette (`--ink`, `--accent`, `--paper`, `--glass-*`, ombre, radius) → convertita in **HSL** e aggiunta a `src/index.css` come token `--funnemail-*` (namespaced, non sovrascrive niente di esistente).
- Classi utility glassmorphism, sidebar sliding, mascot frame → componenti React riutilizzabili in `src/v2/ui/atoms/funnemail/`:
  - `FunnemailGlassCard.tsx`
  - `FunnemailSectionShell.tsx` (layout 2-3 colonne del prototipo)
  - `FunnemailMascot.tsx`
  - `FunnemailToneChip.tsx` (preset tono)
  - `FunnemailViewSwitch.tsx` (FunneMail/Globale)
- Asset copiati in `src/assets/funnemail/`: `funnemail-logo.png`, `mascot.png`, icone SVG.

Nessuna modifica al `tailwind.config.ts` se non aggiunta di token namespaced.

---

## Fase 2 — Riveste le pagine esistenti (logica intatta)

| Pagina V2 esistente | Nuova grafica | Logica |
|---|---|---|
| `FunnemailInboxPage.tsx` | Layout 2 colonne del prototipo `inbox.html` + sidebar filtri + ViewSwitch FunneMail/Globale | Stesso `useFunnemailInbox`, stessi bulk, claim, reclassify |
| `EmailIntelligencePage.tsx` (10 tab) | Header + struttura 3 colonne come `intelligence-manual.html` + KPI grid come `intelligence-senders.html` | Stessi hook/DAL; le 10 tab restano ma con look glass |
| `EmailLabPage.tsx` (Funnemail tab) | Toolbar e flow come `index.html` Mail Playground | `FunnemailTab` invariato |
| `MessageClaimBanner` | Bordo + tipografia del prototipo | Stessa logica claim |

---

## Fase 3 — Nuove pagine richieste dal prototipo (solo UI, dati dai DAL esistenti)

1. **`/v2/funnemail`** — Hub landing "Tutto quello che puoi fare" (5 card → Inbox, Mail Playground, Cataloga mittenti, Statistiche, Impostazioni). Grafica del file `funnemail-index.html`. Zero logica: solo `<Link>` alle route esistenti.
2. **`/v2/funnemail/playground`** — Mail Playground con switch FunneMail/Globale, preset tono (6 chip), "Componi a selezionati", "Regola automatica" inline, "Prompt AI personale" inline. Layout 1:1 con `index.html`. Sotto il cofano collega `EmailEditorPanel` + `improve-email`/`generate-email` via `invokeAi()` (già esistenti).
3. **`/v2/funnemail/statistiche-mittenti`** — KPI grid + lista mittenti aggregata. Grafica `intelligence-senders.html`. DAL: riusa `listEmailSenderStats` esistente.

---

## Fase 4 — Spostamento maschere tecniche fuori da Funnemail (solo navigazione)

Le maschere restano nei loro file e route. **Cambia solo dove appaiono nel menu**:

| Maschera | Era in | Va in |
|---|---|---|
| Operations + Brain | tab di `/v2/email-intelligence` | sezione **Analytics** → `/v2/analytics/funnemail-ops` (alias route della stessa pagina) |
| Job Ledger | sparso | sezione **Analytics** → stessa pagina ops, tab dedicata |
| Scout Cache | tab Email Intelligence | sezione **Settings** → `/v2/settings/funnemail-advanced` (sub-tab) |
| Eval Set | tab Email Intelligence | sezione **Settings** → stessa pagina, sub-tab |
| Routing Rules | tab Email Intelligence | sezione **Settings** → stessa pagina, sub-tab |
| Simulator | già in `/v2/prompt-lab` | resta lì |

Le vecchie route restano funzionanti (alias) per non rompere link salvati. Solo `registry.ts` + `breadcrumbConfig.ts` cambiano la collocazione visibile.

`MessageClaimBanner`: aggiunto flag `VITE_FUNNEMAIL_CLAIM_ENABLED` (default `false` → nascosto in singolo-operatore; quando in futuro arriverà un secondo operatore, basterà accendere il flag).

---

## Cosa NON tocco (nodi critici)
- `useFunnemailInbox`, `useEmailIntelligence`, hook claim, hook brain
- DAL `funnemail*.ts`, `emailProcessingJobs.ts`, `emailSenderStats`
- Edge functions: `check-inbox`, `funnemail-classify-and-route`, `funnemail-send-autoresponder`, classify-*, agent-*
- RLS, query keys, journalistReview, hard guards, idempotency
- AI Invocation Charter: ogni nuova chiamata AI passa da `invokeAi()` esistente

---

## Verifica fine lavori
- Inbox apre, filtra, classifica, segna letto, archivia → identico
- Claim banner: nascosto di default, visibile con flag
- Sorting queue funziona
- Email Intelligence: tutte le 10 tab vecchie raggiungibili (5 dentro Funnemail + 5 spostate in Settings/Analytics via alias)
- Mail Playground non invia nulla in produzione (è un editor; submit reale resta nei flussi outreach esistenti)
- Build pulita, nessuna rottura ai test E2E `funnemail-*.spec.ts`

---

## File previsti (stima)

**Nuovi (~10)**
- `src/index.css` (aggiunta sezione `:root { --funnemail-* }`)
- `src/v2/ui/atoms/funnemail/{FunnemailGlassCard, FunnemailSectionShell, FunnemailMascot, FunnemailToneChip, FunnemailViewSwitch}.tsx`
- `src/v2/ui/pages/funnemail/FunnemailHubPage.tsx`
- `src/v2/ui/pages/funnemail/FunnemailPlaygroundPage.tsx`
- `src/v2/ui/pages/funnemail/FunnemailSenderStatsPage.tsx`
- `src/assets/funnemail/` (logo + mascot + 3 icone)

**Modificati (~6, solo presentazione)**
- `FunnemailInboxPage.tsx` (wrap nella shell prototipo)
- `EmailIntelligencePage.tsx` (header + classi glass; tab logica intatta)
- `MessageClaimBanner.tsx` (flag + restyle)
- `src/v2/navigation/registry.ts` (sposta voci, aggiunge hub e 3 nuove route)
- `src/v2/routes.tsx` (3 nuove route + 2 alias)
- `src/v2/ui/templates/breadcrumbConfig.ts`

**Migration**: nessuna.
**Edge function nuove**: nessuna.
**Secrets nuovi**: nessuno. Solo `VITE_FUNNEMAIL_CLAIM_ENABLED` opzionale in `.env.example`.

---

## Rollback
Tutto reversibile rimuovendo le nuove pagine e ripristinando `registry.ts`/`routes.tsx`. Nessun dato persistente cambia.

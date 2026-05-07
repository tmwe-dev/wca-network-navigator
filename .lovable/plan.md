# UI Structural Alignment — adattato a codex

Il piano caricato è solido nella visione ma viola atomicità (refactor di massa) e duplica codice esistente. Lo splitto in 5 PR sequenziali, ognuno con rollback indipendente. Procedo solo con OK esplicito su ciascun step.

## Modifiche al piano originale

1. **Non creare** `EmptyState.tsx` — esiste già in `src/v2/ui/atoms/`. Verifico la sua API e adatto le 3 props (icon/title/description/action).
2. **`tokens.ts`** invece di stringhe raw → factory `cn()`-ready con commenti che richiamano i token semantic HSL.
3. **Step 4.3 (EmailIntelligence routing)** → spostato in PR separato perché tocca routing (CRITICAL), non solo UI.
4. **Step 4-8 (refactor di massa)** → diventano migrazione **opt-in pagina-per-pagina** dietro audit ESLint, non search-replace globale.
5. Aggiungo verifica visiva (preview screenshot) per ogni PR, non solo `tsc`.

## PR 1 — Primitivi condivisi [STANDARD]

**Obiettivo**: creare le fondamenta, zero migrazione.

- `src/v2/ui/tokens.ts` — costanti `UI_TOKENS` (toolbar, card, page wrapper). Solo classi semantic (`bg-card`, `border-border`).
- `src/v2/ui/atoms/FilterToolbar.tsx` — wrapper props `{children, compact?, className?}`.
- `src/v2/ui/atoms/SurfaceCard.tsx` — props `{variant?: "surface"|"subtle"|"interactive", children, className?}`.
- **Verifica EmptyState esistente** prima di toccarlo: se API diversa da quella del piano, aggiungo overload retro-compatibile invece di breaking change.
- `src/v2/ui/templates/SectionTabs.tsx` → aggiungere prop `variant?: "underline"|"pill"`, default `"underline"` (zero impatto su uso esistente).

**Rollback**: rimozione 3 file nuovi + revert prop `variant` in SectionTabs.
**Verifica**: build + render `/v2/settings` (usa già SectionTabs underline) per confermare default invariato.

## PR 2 — Fix bug visivi puntuali (3 pagine) [STANDARD]

- `FinderApiSchemaMapPage`: rimuovere `container mx-auto p-6 pt-20`, usare `PageTitleHeader` + `h-full flex flex-col`.
- `FunnemailInboxPage`: `h-[calc(100vh-3.5rem)]` → `h-full` (riga 47).
- 5 fix CTA gerarchia: CestinonePage, OutreachPage, EmailComposerPage, AgendaPage, NetworkPage. Solo cambio `variant=` su Button esistenti.

**Rollback**: revert per file. Ogni fix è 1-3 righe.
**Verifica**: screenshot pre/post di ognuna delle 3 pagine principali.

## PR 3 — Migrazione FilterToolbar (opt-in, 6 pagine pilota) [STANDARD]

Solo le 6 pagine elencate nel piano (non "tutte"):
CestinonePage, OutreachPage/CockpitContent, InreachPage/InArrivoTab, AgendaPage, NetworkPage, SettingsPage nav.

Non tocco le altre finché non valuto regressioni di queste 6. Niente search-replace globale.

**Rollback**: revert per pagina.
**Verifica**: screenshot ciascuna delle 6 pagine.

## PR 4 — EmailIntelligence: tabs route-based [CRITICAL]

Tocca routing → CRITICAL.
- `EmailIntelligencePage` da `Tabs` shadcn → `SectionTabs variant="underline"` con sotto-route lazy.
- Aggiungere route figlie sotto `/v2/email-intelligence/:tab`.
- Mantenere redirect dal path attuale per non rompere bookmark esistenti.

**Mappa impatto**: link interni dal Dashboard, dal menu, dalle notifiche. Devo cercare tutti i link a quella pagina.
**Rollback**: revert + rimozione route figlie.
**Verifica**: navigazione manuale tra tab, deep-link diretto a ciascun tab, ritorno al path originale.

## PR 5 — Cleanup tipografia/radius [STANDARD, scaglionato]

NON faccio search-replace globale. Approccio:
- Aggiungere **regola ESLint custom** che vieta `text-[9px]`, `text-[11px]`, `text-[13px]`, `text-[15px]`, `rounded-2xl` come **warning** (non error) → CI mostra il debito ma non blocca.
- Migrazione manuale solo nelle pagine già toccate dai PR 2-4 (per coerenza locale).
- Le restanti istanze restano debito tracciato in `docs/debt/ui-typography-radius.md` con count baseline e target di azzeramento progressivo.

**Rollback**: rimozione regola ESLint + doc.
**Verifica**: `npm run lint` mostra le occorrenze conteggiate; nessun file di logica toccato.

## Step esclusi dal piano (NON eseguo)

- **STEP 5 originale "Empty state migration 114 istanze"** → da fare solo dopo PR 1 e con audit per pagina, non in massa. Sposto in **debito tracciato**.
- **STEP 7 originale "Card → SurfaceCard 20+ pattern"** → idem, opt-in.
- **STEP 8 originale "Border radius 60+32 istanze"** → solo via ESLint warn (PR 5).

## File NON tocco (rispetto vincolo del piano)

`src/integrations/supabase/*`, `_shared/aiInvocationGuard.ts`, `_shared/costGuardrail.ts`, `supabase/config.toml`, `AuthenticatedLayout.tsx`, `LayoutHeader.tsx`, `PageTitleHeader.tsx`.

## Decisione richiesta

Procedo con **PR 1** (primitivi condivisi, zero migrazione, zero rischio)?
Oppure preferisci che parta da **PR 2** (fix bug visivi puntuali, più alto valore percepito immediato)?

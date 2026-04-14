

# Piano: Type Safety + Fix /v2/globe

Tre problemi da risolvere in ordine di priorità.

---

## Problema 1: /v2/globe reindirizza a /onboarding (V1)

**Causa**: `GlobePage` (V2) wrappa `SuperHome3D` (V1), che a riga 102 fa `navigate("/onboarding")` — rotta V1. Quando l'utente è su V2, il redirect va fuori dal contesto V2 e atterra sulla pagina di onboarding V1.

**Fix**: `GlobePage` non dovrebbe wrappare SuperHome3D (che è la Dashboard V1, non un globo 3D). Il nome è fuorviante. Va sostituito con un componente dedicato che mostri il contenuto corretto per la pagina Globe, oppure — se il Globe è effettivamente la dashboard V2 — va rimosso il redirect interno o reso context-aware (`/v2/onboarding`).

**Azione**: Modificare `GlobePage.tsx` per montare direttamente il componente globo (`SuperHome3D` contiene la dashboard, NON il globo). Serve verificare quale componente 3D era originariamente inteso (probabilmente il globo WCA con i partner). Se il componente globe non esiste come standalone, creare un wrapper leggero che usi `usePartnersForGlobe` senza il redirect a onboarding.

---

## Problema 2: 149 `any` non-disabled (esclusi download/email)

**Categorie principali**:

| Categoria | Count | Fix |
|---|---|---|
| Supabase `.insert()`/`.update()` con `Record<string,unknown>` | ~24 | Creare tipi `Insert`/`Update` dai Zod schema esistenti |
| Web Speech API (`window as any`) | ~8 | Usare `eslint-disable` + commento (API non in lib TS) |
| Supabase join/select dinamico | ~20 | Aggiungere interfacce tipizzate per i risultati join |
| Partner/Contact shape casting | ~30 | Usare i tipi da `types.ts` generato |
| Extension bridge payload | ~10 | Creare interfacce per i messaggi bridge |
| Restante | ~57 | Mix di quick casts risolvibili con interfacce specifiche |

**Strategia**: Lavorare sui 25 file con più `any`, concentrandosi su:
1. **DAL** (`src/data/*.ts`): Creare tipi Insert specifici per ogni tabella
2. **Hooks** (`usePartnerListStats`, `useSystemDirectory`, etc.): Aggiungere interfacce per i risultati Supabase
3. **Componenti** (`PartnerListItem`, `PartnerDetailCompact`, `CountryOverview`): Usare i tipi Partner/Contact esistenti
4. **Web Speech**: Aggiungere `eslint-disable` con motivazione (legittimo, API non tipizzata)

**Target**: Da 149 a < 30 non-disabled, da 106 disabled a < 50 (consolidando quelli con motivazione valida).

---

## Problema 3: 106 `any` disabled (esclusi download/email) — target < 50

**Azione**: Rivedere i 106 `eslint-disable` e per ognuno:
- Se il tipo è derivabile → rimuovere il disable e tipizzare
- Se è legittimo (Web Speech, Supabase Json, extension bridge) → mantenere
- Se è duplicato di un pattern già tipizzato → aggiornare

Stima: ~60 sono convertibili in tipi propri, ~46 restano come disable legittimi.

---

## Passi di implementazione

1. **Fix GlobePage** — Sostituire il wrapping di SuperHome3D con il componente corretto o creare un Globe standalone senza redirect
2. **Creare tipi Insert/Update** per le tabelle Supabase più usate nei DAL (`partners`, `activities`, `contacts`, `interactions`, ecc.)
3. **Tipizzare i top-25 file** con più `any` non-disabled, partendo dai DAL poi hooks poi componenti
4. **Consolidare eslint-disable** — rimuovere quelli ora risolvibili con i nuovi tipi
5. **Verificare**: `npm run build` + `grep` count finale

---

## Dettaglio tecnico

File prioritari da fixare (top ROI — coprono ~60% degli `any`):

```text
src/data/partners.ts                         6 any
src/hooks/useWhatsAppBackfill.ts             5 any
src/pages/Operations.tsx                     4 any
src/hooks/useSystemDirectory.ts              4 any
src/hooks/usePartnerListStats.ts             4 any (+ 2 disabled)
src/hooks/useExtensionBridge.ts              4 any
src/hooks/useContinuousSpeech.ts             4 any
src/components/partners/PartnerListItem.tsx   4 any
src/components/partners/PartnerDetailCompact  4 any
src/components/contacts/bca/BCAOcrConfidence  4 any
src/components/partners/CountryOverview.tsx   3 any
src/hooks/useHoldingMessages.ts              3 any
src/hooks/useAiVoice.ts                      3 any
src/components/agents/AgentKnowledgeBase.tsx  3 any
```


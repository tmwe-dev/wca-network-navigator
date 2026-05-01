## Obiettivo

Sostituire la vista attuale di **Pipeline → Biglietti** (`BusinessCardsHub.tsx`) con la stessa, identica vista che era dentro Network → BCA: **`BusinessCardsView`**, già completa di sidebar paesi, dashboard qualità, raggruppamento per azienda e 3 view-mode (compact / grid / **expanded ← default richiesto "più grande"**) + Timeline Evento.

L'utente preferisce quella resa visiva — più ricca, raggruppata, con bandiere paese leggibili e contatti raggruppati per azienda — e vuole che sia il **formato grande (expanded)** quello mostrato di default.

---

## Cosa cambia

### 1. Routing della tab "Biglietti"

`src/v2/ui/pages/sections/PipelineSection.tsx` — la rotta `/v2/pipeline/biglietti` oggi monta `BusinessCardsHub`. La cambiamo per montare la vista grande:

```text
biglietti → <BusinessCardsView />   (al posto di BusinessCardsHub)
```

`BusinessCardsView` è già implementata e funzionante: era usata in Network prima della rimozione del toggle Partner/BCA. Non va riscritta, solo riattaccata alla nuova rotta.

### 2. View-mode di default = "expanded"

In `src/components/operations/bca/useBcaGrouping.ts` (o nel componente `BusinessCardsView` stesso, dove viene inizializzato `viewMode`) impostare il default a `"expanded"` invece di `"compact"`. Verifico la sede esatta in fase di implementazione: se l'init è dentro `useBcaGrouping`, lo cambio lì; altrimenti aggiungo un override in `BusinessCardsView` al primo mount.

Le 3 view-mode (compact / grid / expanded) restano selezionabili dalla sidebar: cambia solo il default.

### 3. Pulizie correlate

- **Mantenere** la pill `AnagraphicsPills active="biglietti"` nella top bar: la monta `BusinessCardsView` aggiungendo `<AnagraphicsPillsPortal active="biglietti" />` come prima riga del JSX (analogo a come già fa `BusinessCardsHub` oggi).
- **Mantenere** il pulsante **Sincronizza** già presente nella toolbar di `BusinessCardsView` (non c'è importazione file: la sync-business-cards edge function popola dal feed condiviso, coerente con la richiesta precedente di eliminare l'upload manuale).
- `BusinessCardsHub.tsx` **non viene cancellato** dal repository (rispetta la regola "non eliminare codice in `src/components/`"); resta orfano e potremo riusarlo o rimuoverlo in seguito.

### 4. Dimensione "più grande"

L'utente ha specificato "nella versione più grande". La view `expanded` di `BcaExpandedCard` è già il rendering più grande (card a piena larghezza con avatar, contatti, badge, azioni inline). Sarà quella di default. Se nel rendering attuale `expanded` risultasse comunque troppo compatta nella tab Pipeline (causa contenitore stretto), aumenterò leggermente padding/icon-size del solo `BcaExpandedCard` per dare più respiro, senza toccare l'uso che ne fa Network (modifica retrocompatibile).

---

## Dettagli tecnici

| File | Modifica |
|---|---|
| `src/v2/ui/pages/sections/PipelineSection.tsx` | sostituire `lazy(() => import(".../BusinessCardsHub"))` con `lazy(() => import(".../operations/BusinessCardsView").then(m => ({ default: m.BusinessCardsView })))` |
| `src/components/operations/BusinessCardsView.tsx` | aggiungere in cima al JSX `<AnagraphicsPillsPortal active="biglietti" />` per mantenere la pill attiva nella top bar |
| `src/components/operations/bca/useBcaGrouping.ts` | cambiare `useState<ViewMode>("compact")` → `useState<ViewMode>("expanded")` |
| `src/components/operations/bca/BcaCardRenderers.tsx` | (eventuale) micro-tuning di `BcaExpandedCard` per renderlo più "grande" se serve, mantenendo retrocompatibilità |

Nessuna modifica a edge functions, DAL, RLS, hook dati o logica di business. Solo presentazione.

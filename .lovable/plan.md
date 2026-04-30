## Problema osservato (dallo screenshot)

L'header di **Contatti** ha **4 strati impilati** che dicono più o meno la stessa cosa, più filtri che si sovrappongono al selettore di origine:

```text
[icon] CONTATTI · Elenco        Elenco | Kanban | Duplicati | Campagne | Agenda     ← strato 1: header pagina
ORIGINE  [WCA Partner] [Contatti] [Biglietti]                                       ← strato 2: switcher origine
Home > Contatti > Elenco                                                            ← strato 3: breadcrumb (= "altro tasto Home")
11349 contatti  [Fuori circuito] [Tutti] [WCA ✓] [Solo CRM]   Segmenti  + Nuovo     ← strato 4: filtri lista (ridondanti con origine)
```

Risultato: la parola "Elenco" appare 3 volte, "Contatti" 3 volte, "Home" 2 volte, e i bottoni `Tutti / WCA ✓ / Solo CRM` fanno la stessa cosa del selettore `Origine`.

## Cosa fare — UI only, una sola passata

### 1. Eliminare il breadcrumb interno alla sezione Contatti

Il breadcrumb `Home > Contatti > Elenco` è il "altro tasto Home" che hai notato. La voce **Home** è già nel menu sinistro e l'header pagina dice già `CONTATTI · Elenco`. Il breadcrumb è ridondante.

→ Nascondere il breadcrumb sulla sezione `/v2/pipeline/*`. Resta solo l'header unificato.

### 2. Fondere l'header pagina e lo switcher origine in **una sola riga**

Oggi ci sono 2 righe (header + ORIGINE). Le unisco così:

```text
[👥] CONTATTI    Elenco · Kanban · Duplicati · Campagne · Agenda    ⋯    + Nuovo
                  └ origine: ◉ Contatti  ○ WCA Partner  ○ Biglietti
```

L'origine diventa una riga sottile sotto i tab di lavoro, sempre visibile ma non urlante. Niente etichetta "ORIGINE" tutta maiuscola — basta un selettore segmentato compatto.

Rimuovo dall'header:
- la doppia scritta "Elenco" (badge sezione `· Elenco` + primo tab `Elenco`) → tengo solo i tab.
- la striscia `ORIGINE` come banda separata → diventa una riga inline sotto i tab.

### 3. Rimuovere i filtri ridondanti dentro `ContactListPanel`

Questi bottoni dentro la lista oggi sono confusi e doppi:
- `Tutti / WCA ✓ / Solo CRM` → fa la stessa cosa del selettore Origine (WCA Partner / Contatti / Biglietti). Lo elimino.
- Il chip `Fuori circuito` resta (è un filtro reale di stato, non di origine).

### 4. Risultato finale

```text
[👥] CONTATTI    Elenco | Kanban | Duplicati | Campagne | Agenda            + Nuovo
                 ◉ Contatti  ○ WCA Partner  ○ Biglietti
─────────────────────────────────────────────────────────────────────────────────────
11.349 contatti  ✈ Fuori circuito                              Segmenti
```

3 righe invece di 5, zero parole ripetute, zero filtri doppi. Il tasto Home resta solo nel menu sinistro.

## File toccati (solo UI/layout, zero logica)

1. `src/v2/ui/pages/sections/PipelineSection.tsx`
   - Rimuovo il componente `OrigineSwitcher` come banda separata.
   - Passo le 3 origini come segmented inline-row dentro `PageHeaderUnified` (nuova prop `subRow` o riutilizzo `chips` con tone "primary" e logica radio).

2. `src/v2/ui/templates/PageHeaderUnified.tsx`
   - Rimuovo la duplicazione `sectionLabel · currentTab.label`: tengo solo `sectionLabel` se uguale al tab attivo, altrimenti il tab attivo.
   - Aggiungo (o riuso) una "subRow" sottile per il selettore origine.

3. `src/v2/ui/templates/breadcrumbConfig.ts` o il layout che lo monta
   - Disattivo il breadcrumb interno per i path `/v2/pipeline/*` (la sezione si auto-descrive nell'header).

4. `src/components/contacts/ContactListPanel.tsx`
   - Rimuovo il blocco `Tutti / WCA ✓ / Solo CRM` (righe ~91-98). Lascio il chip "Fuori circuito" e il counter.
   - L'hook `useContactListPanel` resta invariato: il param `wcaMatch` viene forzato a `"all"` quando la pagina è dentro la pipeline unificata (delegato all'origine).

## Cosa NON cambia

- Routing, redirect dei vecchi URL, dataset, RLS, edge function: invariati.
- Tab di lavoro (Elenco/Kanban/Duplicati/Campagne/Agenda): invariati.
- Componenti interni (`ContactsPage`, `BusinessCardsHub`, `NetworkPage`, `ContactPipelineView`, `DuplicateDetector`): invariati.
- Menu sinistro: invariato (resta una sola voce "Contatti").

## Verifica post-implementazione

- Aprendo `/v2/pipeline/contacts?origine=crm` vedo **una sola** riga "Contatti" + tab di lavoro + selettore origine sottile sotto. Niente breadcrumb.
- La parola "Elenco" appare **una volta sola** (nel tab attivo).
- I bottoni `Tutti / WCA ✓ / Solo CRM` non esistono più dentro la lista.
- Cambiando origine (Contatti → WCA → Biglietti) cambia il dataset, il selettore resta nello stesso posto.

## Cosa ho verificato (situazione reale)

**1. Biglietti da visita — dove compaiono oggi**

| Posizione | Cosa mostra | Verdetto |
|---|---|---|
| `/v2/pipeline/biglietti` | `BusinessCardsHub` — pagina dedicata BCA | ✅ Casa madre |
| `/v2/explore/network` (WCA Partner) | `OperationsView` ha un toggle interno **Partner / BCA** che monta `BusinessCardsView` | ❌ **Duplicato reale** — stessa pagina dentro Network |
| `/v2/pipeline/contacts` (Contatti CRM) | **Non mostra biglietti come entità.** Mostra solo i filtri "WCA ✓ / Solo CRM" sui contatti | ✅ Nessun duplicato (sono contatti, non biglietti) |

→ Da rimuovere: il toggle "BCA" dentro Network. I biglietti vivono solo in Pipeline › Biglietti.

**2. Menu a 3 righe in Contatti CRM (screenshot 1)**

Le righe accumulate sono:
1. **Tabs sezione** (Contatti / Kanban / Biglietti / Duplicati / Campagne / Agenda) — `SectionTabs`
2. **Breadcrumb** "Home › Pipeline › Contatti CRM" — `GoldenHeaderBar`
3. **Barra contatori + filtri** "11349 contatti · Fuori circuito · Tutti · WCA ✓ · Solo CRM · Segmenti · Nuovo"
4. **Barra gruppi paese** con bandierine
5. **Header colonne** (Azienda / Contatto / Città / Origine)

Il problema vero: 1 + 2 sono ridondanti (i tabs già dicono dove sei). 3 + 4 sono due barre di filtri che potrebbero stare insieme.

**3. Kanban che piace (screenshot 3)**

`ContactPipelineView` ha: una sola riga di KPI con icone colorate e contatore inline, sotto la barra di funnel con percentuali, poi le colonne. **Niente breadcrumb, niente filtri ripetuti, tutto leggibile a colpo d'occhio.** Questo è lo standard da estendere.

---

## Piano (3 step, uno per volta come chiede l'utente)

### Step A — Rimuovere il duplicato Biglietti da Network
- In `src/components/operations/OperationsView.tsx`: togliere il toggle Partner/BCA e il branch che renderizza `BusinessCardsView`. `NetworkPage` mostra **solo partner**.
- Aggiungere in `BusinessCardsHub` un pulsante "Sync da Network" (la stessa azione `sync-business-cards`) così la funzione non si perde.
- `/v2/network` resta = WCA Partner. I biglietti si gestiscono solo in `/v2/pipeline/biglietti`.

### Step B — Compattare l'header di Contatti CRM in una sola riga "Kanban-style"
Adottare la grammatica visiva del Kanban su tutta la sezione Pipeline:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Tabs sezione (Contatti CRM | Kanban | Biglietti | …)                 │  ← unica navigazione
├──────────────────────────────────────────────────────────────────────┤
│ 11 349 contatti  ✈ 0  📩 1  ⏰ 0  ❄ 1  ⭐ 0  🤝 0      ⚙ Filtri  + │  ← riga KPI+azioni
├──────────────────────────────────────────────────────────────────────┤
│ Paese ▾  Tutti  🇦🇫 AF (1)  🇦🇱 AL (1)  🇦🇴 AO (6)  …                │  ← gruppi (resta)
└──────────────────────────────────────────────────────────────────────┘
```

Cosa cambia concretamente:
- **Nascondere il `GoldenHeaderBar` (breadcrumb) sulle pagine Pipeline**: i tabs di sezione sono già il "dove sei". Una prop `hideBreadcrumb` su `PipelineSection` o omissione del componente.
- **Fondere la riga "11349 contatti + Fuori circuito + WCA✓/Solo CRM + Segmenti + Nuovo" in una singola toolbar Kanban-style**: contatore a sinistra, mini-KPI con icona (come il Kanban: 👤 0  📨 1  ⏰ 0  ❄ 1), filtri WCA come pill compatte, "Segmenti" e "+ Nuovo" a destra.
- **Mantenere la barra Paese** (è informativa, non duplicata).
- **Rimuovere la riga "header colonne sortabili"** quando lo spazio è stretto: il sort si attiva da un menu kebab sulla colonna, oppure si tiene ma con padding ridotto.

Risultato: da 5 righe → **3 righe** (tabs + toolbar unica + gruppi paese).

### Step C — Estendere lo stile Kanban anche a Network e Biglietti
Una volta validato in Contatti CRM, applico la stessa toolbar compatta a:
- `BusinessCardsHub` (Pipeline › Biglietti)
- `OperationsView` (Network › WCA Partner)

Stessa regola: una sola riga di KPI con icone semantiche colorate, niente breadcrumb ridondante, filtri come chip inline.

---

## Dettagli tecnici (per chi legge il codice)

- **Toggle BCA da rimuovere**: `OperationsView.tsx` righe ~43-98 (`networkView` state + `<CreditCard /> BCA` button + branch `activeView === "bca"`).
- **Breadcrumb da nascondere in Pipeline**: `PipelineSection.tsx` non monta direttamente `GoldenHeaderBar`, ma lo eredita dal layout. Aggiungere `hideHeader` o un flag locale; altrimenti rimuovere `GoldenHeaderBar` dal layout per la route `/v2/pipeline/*`.
- **Toolbar unificata**: nuova `ContactsToolbar` (compact) che assorbe l'attuale "Header" (riga 75-100 di `ContactListPanel.tsx`) + `ContactSegments` + KPI da `useContactListPanel` (totalCount, holdingPattern, ecc.).
- **Niente modifiche a logica/dati**: solo presentazione. Filtri WCA, segmenti, ordinamento e selezione restano gli stessi hook.

---

## Cosa NON faccio in questo piano
- Non tocco la logica di filtro contatti, RLS, hook dati.
- Non cambio il routing (`/v2/pipeline/biglietti` resta).
- Non rinomino tabs.
- Non tocco il Kanban (ti piace così com'è).

Procedo step-by-step: **prima Step A** (rimuovere duplicato Biglietti da Network), poi mi confermi e passo a Step B.
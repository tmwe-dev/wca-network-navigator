

## Analisi Comparativa: Contatti vs Rubrica Partner

### Cosa ha Contatti che Rubrica NON ha

| Funzione | Contatti | Rubrica |
|---|---|---|
| **AI Assistant** (barra comandi naturali) | Si — filtra, ordina, seleziona, esporta via linguaggio naturale | No |
| **Raggruppamento flessibile** (Paese/Origine/Status/Data) | Si — 4 modalità con accordion | No — solo Paese (CountryCards + Workbench) |
| **Holding Pattern** (In circuito / Da lavorare) | Si — toggle dedicato | No |
| **Import baskets** (Cestini di importazione) | Si — dropdown per filtrare per batch di import | No (non applicabile) |
| **Date picker range** (filtra per data importazione) | Si | No |
| **Esporta CSV** via AI | Si | No |
| **Timeline interazioni** nel dettaglio | Si — con dialog per aggiungerne di nuove | No (ha interactions ma in altro formato) |

### Cosa ha Rubrica che Contatti NON ha

| Funzione | Rubrica | Contatti |
|---|---|---|
| **Pannelli ridimensionabili** (ResizablePanel) | Si | No — larghezza fissa 420px |
| **UnifiedActionBar** contestuale (singolo/bulk) | Si — barra sopra i pannelli | No — bulk bar inline semplice |
| **Deep Search integrata** con progresso | Si — con start/stop e progress bar | No — solo placeholder toast |
| **CountryWorkbench** (drill-down per paese) | Si — ordinamento multi-criterio, filtri servizi, icone | No |
| **PartnerDetailFull** premium (glassmorphism) | Si | No — detail panel basico |
| **Filtri avanzati** (servizi, network, certificazioni, rating, anni, filiali, scadenze) | Si — PartnerFiltersSheet | No |
| **Send to Workspace** funzionante | Si — crea attività + naviga | Si ma meno integrato |

### Cosa migliorare — Il Piano

#### 1. Layout ridimensionabile (come Rubrica)
Sostituire il layout fisso `w-[420px]` con `ResizablePanelGroup` identico alla Rubrica.

**File:** `src/pages/Contacts.tsx`

#### 2. Compattare e riorganizzare la FilterBar
L'attuale `ContactFiltersBar` ha 4 righe dense (cestino, AI, ricerca, raggruppamento, 3 dropdown, 2 date picker + sort). Troppo verticale.

Nuovo layout:
- **Riga 1 (header fisso)**: Contatore totale + Ricerca (come Rubrica)
- **Riga 2**: Raggruppamento icone (Paese/Origine/Status/Data) + Holding Pattern toggle + Sort dropdown — tutto compatto nella stessa riga
- **Sezione collassabile "Filtri"**: Cestino import, Paese, Origine, Status, Date range — visibili solo on-demand con un bottone Filter (come PartnerFiltersSheet)
- **AI Bar**: resta ma spostata sotto la ricerca, con toggle per mostrarla/nasconderla

**File:** `src/components/contacts/ContactFiltersBar.tsx`

#### 3. Bulk Action Bar allineata a UnifiedActionBar
Trasformare la barra bulk attuale (inline con 5 bottoni testo) in una barra compatta con icone + tooltip, stesso stile dell'UnifiedActionBar della Rubrica. Posizionarla come header globale sopra entrambi i pannelli.

**File:** `src/pages/Contacts.tsx`, `src/components/contacts/ContactListPanel.tsx`

#### 4. Migliorare il DetailPanel
Il pannello destro è basico. Allinearlo allo stile glassmorphism della Rubrica:
- Header con company name + alias prominenti
- Quick actions come bottoni con icona (stile Rubrica)
- Sezione Holding Pattern con indicator visivo migliorato
- Timeline con stile più premium

**File:** `src/components/contacts/ContactDetailPanel.tsx`

#### 5. Card dei contatti più pulite
Le `ContactCard` mostrano troppi dati inline. Allineare alla densità della `PartnerListItem`:
- Rimuovere email/telefono dalla card (visibili solo nel dettaglio, come in Rubrica)
- Mantenere: azienda, nome/ruolo, città, badge origine, indicatore interazioni
- Aggiungere indice progressivo (#1, #2...) come in Rubrica

**File:** `src/components/contacts/ContactCard.tsx`

### Riepilogo file da modificare

1. `src/pages/Contacts.tsx` — ResizablePanel + bulk bar globale
2. `src/components/contacts/ContactFiltersBar.tsx` — compattamento, collapsible filters
3. `src/components/contacts/ContactListPanel.tsx` — estrazione bulk bar, pulizia
4. `src/components/contacts/ContactDetailPanel.tsx` — stile premium allineato a Rubrica
5. `src/components/contacts/ContactCard.tsx` — semplificazione, rimozione email/phone dalla card

### Cosa portare da Contatti a Rubrica (fase successiva)
- AI Assistant (ContactAIBar) — adattarlo anche per Rubrica
- Raggruppamento flessibile (non solo per paese)
- Esporta CSV
- Date range filter


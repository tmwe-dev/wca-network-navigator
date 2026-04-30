## Obiettivo

Replicare l'ergonomia del **Kanban** (pulito, colorato, denso, leggibile) su **tutte** le pagine di gestione contatti, e dare all'utente un'evidenza chiara di **dove si trova** — senza più 4-5 righe orizzontali sopra al contenuto.

## Problemi da eliminare (confermati dagli screenshot)

1. **Stratificazione verticale** che divora 30% di schermo: app-header → section-tabs → breadcrumb → page-tabs → counters/filters → grid-header.
2. **Nessun indicatore di pagina corrente** forte (titolo + icona della sezione assenti).
3. Bandiere micro (text-base), testo grigio scuro su scuro, badge poco leggibili.
4. **Biglietti**: enorme dropzone "Trasferisci o file dati" sprecata in cima, mentre l'import vive nella sua pagina dedicata.
5. Inconsistenza tra CRM / Biglietti / Network (ognuna con header diverso).

## Soluzione: il "Page Header Kanban-style" come template unico

Una **singola riga compatta (h-12)** sostituisce breadcrumb + section-tabs + page-tabs + counters separati.

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [icon] Pipeline · Contatti CRM     ▸ Kanban  Contatti  Biglietti  Duplicati  ⋯  │
│        11.349 contatti · 🟣Tutti · ✈️ Fuori circuito                  [+ Nuovo] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Riga 1 (h-7)** — Identità + tabs sorelle:
- A sinistra: icona sezione colorata (12px) + `Sezione · Pagina corrente` in `text-sm font-bold` (la pagina corrente in colore primary). Sostituisce breadcrumb e tab strip separati.
- Tabs sorelle inline a destra dell'identità (Kanban / Contatti / Biglietti / Duplicati / Campagne / Agenda) come pill compatte, quella attiva ha background primary/15.
- A destra dell'header: `[+ Nuovo]`, `Segmenti`, kebab `⋯` per azioni secondarie.

**Riga 2 (h-7)** — Stato contestuale (counter + chip filtri attivi):
- Counter principale `11.349 contatti` in `text-sm font-semibold`.
- Chip filtri sempre visibili e cliccabili: `Tutti / WCA / Solo CRM / Fuori circuito`.
- I chip rimangono SEMPRE visibili (no menu), perché sono lo stato dell'elenco.

Totale verticale: **≈ 56px** invece degli attuali ~180-220px.

## Pagine impattate

### A. CRM (Contatti / Kanban / Biglietti / Duplicati / Campagne / Agenda)
File: `src/v2/ui/pages/CRMPage.tsx` + sotto-pagine.
- Sostituire `GoldenHeaderBar` + `SectionTabs` + header della singola pagina con un **unico componente** `<PageHeaderUnified />`.
- Tabs Kanban/Contatti/Biglietti/Duplicati spostate dentro l'header unificato.
- Breadcrumb rimosso (l'identità "Pipeline · Pagina" lo sostituisce).

### B. Biglietti (`/v2/pipeline/biglietti`)
- **Rimuovere completamente** la dropzone "Trasferisci o file dati" dal top.
- Sostituirla con un piccolo bottone secondario `↓ Importa` nell'header che linka alla pagina Import dedicata.
- Le card biglietto ricevono lo stesso trattamento delle card contatto (vedi sotto).

### C. Network (`/v2/explore/network`)
- Header unificato: `🛰 Esplora · Network` con tabs `WCA Partner / Mappa / Sherlock` inline.
- Card "Tutti i paesi" e griglia paesi: bandiere `text-3xl` (vs `text-2xl` attuale), counters `text-base font-bold`, eliminare il box "Ordine: Nome" che spreca riga (passa a kebab azioni).

### D. Card lista contatto/partner — riallineamento "Kanban-style"
Riferimento: la card `Mario Rossi / TestCorp / mario@test.com / 0 interazioni` del Kanban (ultima foto), che è esattamente il livello di pulizia richiesto.

Modifiche a `ContactCard.tsx` / `PartnerVirtualList.tsx`:
- Bandiera `text-4xl` (48px) in slot dedicato 56×56 (oggi 36px in slot 48px → troppo piccola).
- Nome azienda `text-base font-bold text-foreground` (oggi text-sm).
- Sotto-riga: `Persona · Ruolo` in `text-sm text-foreground/85`.
- Email/telefono in `text-xs text-foreground/70` con icona inline.
- Badge origine (CSV/WCA/BCA) in `text-[11px] uppercase font-bold` con bg colorato pieno (non outline).
- Sfondo card: gradient sottile `from-card to-card/60` come le colonne Kanban, bordo `border-border/40`, `rounded-xl`.
- Hover: lift `+1px` + bordo `border-primary/40`.

### E. Sezione "indicatore pagina globale"
Nella sidebar laterale a sinistra (`LayoutSidebarNav`), evidenziare con barra primary spessa 3px a sinistra l'icona della pagina corrente (oggi è solo un cambio di colore tenue) → l'utente capisce a colpo d'occhio dove si trova anche dalla nav.

## Nuovo componente

`src/v2/ui/templates/PageHeaderUnified.tsx`

```tsx
interface PageHeaderUnifiedProps {
  sectionIcon: LucideIcon;
  sectionLabel: string;          // "Pipeline"
  pageLabel: string;             // "Contatti CRM"
  siblingTabs: { key, label, to, count? }[];
  counter?: { value: number, label: string };
  filterChips?: { key, label, icon?, active, onClick }[];
  primaryAction?: { label, icon, onClick };
  secondaryActions?: ReactNode;  // kebab content
}
```

Una sola implementazione, riutilizzata da CRM, Network, Biglietti, Outreach, Campagne, Agenda.

## File da modificare

- **Nuovo**: `src/v2/ui/templates/PageHeaderUnified.tsx`
- `src/v2/ui/pages/CRMPage.tsx` — adottare PageHeaderUnified, rimuovere SectionTabs.
- `src/v2/ui/pages/ContactsPage.tsx` — togliere il proprio header interno (delegato).
- `src/components/contacts/ContactListPanel.tsx` — togliere riga counter+chips (passa all'header unificato).
- `src/components/contacts/BusinessCardsHub.tsx` (Biglietti) — **rimuovere dropzone** in top, sostituire con bottone Import nell'header.
- `src/v2/ui/pages/NetworkPage.tsx` — adottare PageHeaderUnified.
- `src/v2/ui/organisms/network/CountryGridV2.tsx` — bandiere `text-3xl`, rimuovere box "Ordine: Nome" dal contenuto.
- `src/components/contacts/ContactCard.tsx` — applicare scala "Kanban-style" (bandiere 48px, nome `text-base font-bold`, gradient sottile).
- `src/components/operations/PartnerVirtualList.tsx` — stessa scala.
- `src/v2/ui/templates/LayoutSidebarNav.tsx` — barra attiva 3px primary a sinistra sulla pagina corrente.
- `src/v2/ui/templates/SectionTabs.tsx` — deprecato per le pagine con PageHeaderUnified (resta per le altre).

## Cosa NON tocco

- BCA `BusinessCardsViewV2.tsx` (già il riferimento visivo).
- Logica/stato (filtri, query, drag&drop Kanban).
- Sidebar a scomparsa filtri (già ok dopo l'ultimo intervento).
- LayoutHeader globale (già compatto a h-11).

## Risultato atteso

- Header pagina passa da **~200px verticali** a **~56px**.
- Pagina corrente sempre evidente (icona+colore in header + barra in sidebar).
- Card leggibili "a 60 anni" con bandiere triple.
- Stessa identità visiva su Contatti / Kanban / Biglietti / Duplicati / Network.


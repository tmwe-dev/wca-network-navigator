
## Obiettivo

Rendere le card di **Contatti CRM** e **Network** chiare, leggibili e ergonomiche, prendendo come riferimento di pulizia la vista **BCA** (che resta intoccata). Eliminare il "grigio su scuro", aumentare i font, ingrandire la bandiera, sfruttare meglio lo spazio orizzontale e ridurre l'altezza dell'header del CRM (oggi i sottomenu si mangiano un terzo della pagina).

## Diagnosi attuale (dagli screenshot + codice)

**CRM `/v2/pipeline/contacts`** — il caso più critico:
- Bandiera renderizzata come emoji 🏳 a `text-base` (~16px) invisibile a colpo d'occhio.
- Tutti i testi a `text-[10px]` / `text-[11px]` (10–11px) → illeggibili sopra i 50.
- Località, città, ruolo, email tutti in `text-muted-foreground` (grigio chiaro su sfondo scuro) → contrasto basso.
- Header impilato: tabs orizzontali (Contatti CRM / Kanban / Bigliet... / Duplicati / Campagne / Agenda) + breadcrumb + barra contatori + chip di gruppo "Paese AF/AL/AO…" → ~5 righe verticali prima di vedere un solo contatto.
- Origine (campo critico per capire "dove l'ho preso") è solo un piccolo chip `text-[9px]` quando presente, spesso non visibile.
- Colonna "Stato" satura di micro-icone monocrome non distinguibili.

**Network `/v2/explore/network`** — situazione media:
- Stessa emoji-bandiera piccola, testi `text-[10px]` nella griglia paesi.
- Nelle righe partner i marker verdi-puntini (Col 5) non si capiscono.
- Le card sono comunque più respirate del CRM.

**BCA** → riferimento, **non toccare**.

## Proposta visiva

### Scala tipografica nuova (applicata solo a CRM + Network)

```
Primario riga         text-sm  (14px)  font-medium  text-foreground
Secondario riga       text-xs  (12px)               text-foreground/80
Meta/decor            text-xs  (12px)               text-muted-foreground
Header colonna        text-xs  (12px)  uppercase    text-foreground/70
```
Niente più `text-[10px]` né `text-[9px]` per dati utente. Le sole eccezioni: numeri di sequenza `#1` e contatori in pillole.

### Bandiera

- Da `text-base` (~16px) a **`text-3xl` (~30px)** — 3x come richiesto — in un quadrato 36×36 con leggero ring, cliccabile per filtrare per paese.
- Su mobile/dense scende a `text-2xl` (24px).

### Card CRM ridisegnata (riga lista)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ #1 ☐ │ 🇮🇹  ITALIA          │ AZIENDA SRL          WCA  │ Sigra Elena       │ ●●● │
│      │ 36px Milano · 20019  │ Sales Manager  [CSV]      │ ✉ a@b.it          │     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Cambiamenti chiave:
- **Bandiera 36×36 px** in slot dedicato a sinistra del blocco Località.
- Paese **`text-sm font-semibold text-foreground`** (non più muted).
- Città · CAP **`text-xs text-foreground/70`** (leggibile, non grigio fantasma).
- Azienda **`text-sm font-bold uppercase text-foreground`**, ruolo `text-xs text-foreground/70`.
- **Origine**: badge ad alto contrasto sempre visibile (anche se vuoto → "—") accanto al nome azienda, colorato in base alla fonte (CSV viola, WCA verde, Manuale ambra, Import giallo). Cliccabile per filtrare.
- Contatto: nome `text-sm`, email `text-xs text-foreground/80` (non muted).
- Stato: la colonna mantiene Score + status, ma le micro-icone (LinkedIn / Globe / Handshake) diventano badge 18×18 con tooltip, raggruppate; niente più puntini illeggibili.
- Altezza riga: da ~44px attuali a ~60px → più aria, più leggibilità, scroll virtualizzato già attivo.

### Compattazione header CRM

Tre azioni per recuperare ~80–100px verticali:
1. **Tabs orizzontali** (Contatti CRM / Kanban / …) → restano, ma diventano `h-9` con underline sottile invece di pill, e il breadcrumb sotto viene **rimosso** (ridondante: la tab attiva è il breadcrumb).
2. **Barra contatori + segmenti + WCA filter + Nuovo** → tutto su **una sola riga** `h-9` invece di due. "Fuori circuito" e "Solo CRM" diventano toggle compatti accanto al conteggio.
3. **Chip paesi** (Tutti / AF (1) / AL (1) / AO (6)…) → diventa **scrollabile orizzontale h-8** sempre con bandiera grande accanto al codice. Resta sempre visibile ma occupa una sola riga.

Risultato: prima del primo contatto si vedono **2 righe** invece di 5.

### Network — interventi mirati

- `CountryGridV2`: bandiera da `text-sm` a **`text-2xl`**, contatore `text-sm font-bold`, etichetta aria con nome paese completo (non solo codice ISO).
- Lista partner sotto (`Tutti i paesi · 12286 partner`): righe con stessa nuova scala (bandiera 36px, nome azienda `text-sm font-semibold`, città `text-xs text-foreground/70`).
- I tre puntini `●●●` di stato vengono sostituiti da 3 badge etichettati ("Email", "WCA", "Attività") con colore semaforo + tooltip.

### BCA

Nessuna modifica. Resta riferimento.

## Filtri cliccabili (chiarimento richiesto)

Il pattern `Filterable` (clicca un valore in card → aggiunge filtro) **già esiste** ed è attivo su country, city, company, name, origin, leadStatus, zip. Lo rendiamo più scopribile:
- Underline tratteggiato sostituito da **hover background pill** (`bg-primary/10 rounded`) — meno rumore visivo costante, feedback chiaro al passaggio.
- Cursor pointer + tooltip "Aggiungi al filtro".
- I chip di filtro attivo in alto già ci sono e già hanno la X per rimuoverli.

## Dettagli tecnici (per chi sviluppa)

File toccati:
- `src/components/contacts/ContactCard.tsx` — nuovo layout righe, bandiera grande, scala font, badge origine, stato pulito.
- `src/components/contacts/contactGridLayout.ts` — `CONTACT_GRID_COLS` ricalibrato: `64px 56px minmax(180px,220px) minmax(180px,1.2fr) minmax(180px,1.4fr) minmax(140px,160px) 72px` (slot bandiera dedicato + colonne più ariose).
- `src/components/contacts/ContactListPanel.tsx` — header compattato (tabs `h-9`, riga unica contatori, chip paesi `h-8`), font header colonne `text-xs`, rimozione breadcrumb ridondante.
- `src/v2/ui/organisms/network/CountryGridV2.tsx` — bandiera `text-2xl`, count `text-sm font-bold`.
- `src/v2/ui/organisms/network/BusinessCardsViewV2.tsx` — **non toccato** (già BCA-style).
- Lista partner Network (componente in `src/components/network/` o equivalente — da identificare al primo passo dell'implementazione) — stessa scala CRM.

Non si tocca:
- Logica dati, hook (`useContactListPanel`), DAL, query keys.
- Sidebar filtri (rivista nel turno precedente).
- Routing, breadcrumb config globale.

## Fuori scope

- Refactor del Kanban / Duplicati / Campagne / Agenda (tabs sorelle).
- Vista mobile dedicata (le breakpoint Tailwind esistenti restano).
- Dark/light theme (semantic tokens già rispettati).

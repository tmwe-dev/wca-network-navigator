## Obiettivo

Unificare l'esperienza visiva delle tre aree che mostrano "persone/aziende" (Contatti CRM, Biglietti da visita BCA, WCA Partner) e collassare i tre item del menu di sinistra in **un solo item "Network"** con tre micro-tab in cima.

---

## 1. Stile elenco unificato (BCA → CRM)

Lo stile dei Biglietti da visita (header compatto + barra paesi con bandiere e contatori + viste card/grid/list + sidebar gruppi) diventa lo standard. La pagina **Contatti CRM** adotta lo stesso scheletro:

```text
┌─ Header compatto: count · badge "Fuori/In circuito" · Segmenti · Nuovo ─┐
├─ Tabs orizzontali paese: 🇮🇹 IT(123) 🇩🇪 DE(45) 🇫🇷 FR(...) ...        ─┤
├─ Toolbar: GroupBy · View toggle (list/card/grid) · Sort · Search       ─┤
├─ ELENCO (stesso ContactCard / BcaCard renderer)        │ DETTAGLIO 60% │
│                                                        │ + strumenti   │
│                                                        │ verifica      │
│                                                        │ Holding ✈️    │
└────────────────────────────────────────────────────────┴───────────────┘
```

Cosa resta invariato sul lato destro del CRM: tutti gli **strumenti di verifica del circuito di attesa** (Holding Pattern, badge ✈️, last-contact, score, escalation) restano nel `ContactDetailPanel`. Aggiungiamo solo il `UnifiedSmartActions` già esistente in alto al pannello dettaglio (già fatto nel passo precedente), così le 8 azioni standard sono uguali ovunque.

Il **menu orizzontale a chip** dei filtri (paese / stato / origine, in funzione del GroupBy attivo) viene estratto in un componente condiviso `EntityCountryTabs` riutilizzato sia da CRM che da BCA — stessa altezza, stesso stile bandiera+contatore, stesso scroll orizzontale.

## 2. Consolidamento navigazione: 1 item invece di 3

Oggi nel menu sinistro abbiamo tre voci separate (Network/WCA Partner, Contatti CRM, Biglietti). Diventano una sola voce **"Network"** con tre micro-tab in cima alla pagina, accanto al breadcrumb già presente in WCA Partner:

```text
Home › Network
┌──────────────────────────────────────────────────┐
│ [ WCA Partner ]  [ Contatti CRM ]  [ Biglietti ] │   ← micro-tabs
├──────────────────────────────────────────────────┤
│  contenuto della tab attiva                      │
└──────────────────────────────────────────────────┘
```

Routing:
- `/v2/explore/network` → tab WCA Partner (default, com'è oggi)
- `/v2/explore/contacts` → tab Contatti CRM (sposta `ContactsPage` qui)
- `/v2/explore/biglietti` → tab BCA (sposta `BCAUnifiedHub` qui)

Sidebar sinistra: rimane solo **"Network"**. Le voci "Contatti CRM" e "Biglietti" vengono rimosse. Le rotte vecchie (`/v2/pipeline/contacts`, `/v2/pipeline/biglietti`) restano come **redirect** a quelle nuove per non rompere link/bookmark.

La sezione **Pipeline** mantiene Kanban, Duplicati, Campagne, Agenda — non più Contatti CRM né Biglietti (che vivono ora in Network).

## 3. File toccati (sintesi tecnica)

**Nuovi**
- `src/v2/ui/molecules/EntityCountryTabs.tsx` — barra paesi condivisa (estratta da BCA).
- `src/v2/ui/pages/sections/NetworkSection.tsx` — wrapper con `SectionTabs` (3 tab) + `<Routes>`.

**Modificati**
- `src/components/contacts/ContactListPanel.tsx` — adotta `EntityCountryTabs` + header compatto stile BCA + view toggle list/card/grid.
- `src/components/contacts/bca/BCAUnifiedHub.tsx` — usa `EntityCountryTabs` al posto della barra paesi inline.
- `src/v2/ui/pages/sections/PipelineSection.tsx` — rimuove tab "Contatti" e "Biglietti", aggiunge redirect.
- `src/App.tsx` (o file routes V2) — registra `/v2/explore/*` su `NetworkSection`.
- Sidebar V2 (`src/v2/ui/.../Sidebar*.tsx`) — rimuove i 3 item, lascia solo "Network".

## 4. Cosa NON cambia
- Logica DAL, hook dati, RLS, Holding Pattern, scoring, drag&drop BCA, `UnifiedSmartActions`.
- Nessuna modifica a edge functions o schema DB.
- I dettagli a destra restano specifici per tipo (Contact / Partner / BCA) — cambia solo l'**involucro** elenco e la navigazione.

## Conferma
Confermi di procedere con (A) unificazione stile elenco CRM ↔ BCA e (B) consolidamento delle 3 voci di menu in **Network** con 3 micro-tab?
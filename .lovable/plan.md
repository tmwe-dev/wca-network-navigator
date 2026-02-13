

## Prospect Center — Hub Dedicato Report Aziende

Creare una pagina completa in stile Operations Center ma dedicata ai prospect italiani di Report Aziende. Layout 35/65 con glassmorphism, tema dark/light, stesso look & feel.

### Struttura

**Pannello sinistro (35%) — Griglia ATECO**
- Lista dei codici ATECO presenti nel database, raggruppati per sezione (primo livello: 2 cifre, es. "46 - Commercio all'ingrosso")
- Ogni card ATECO mostra: codice, descrizione, numero di prospect, indicatori (email, telefono, fatturato medio)
- Ricerca per codice o descrizione
- Filtri nel dropdown: per regione, per provincia, per range fatturato
- Multi-selezione di codici ATECO (come i paesi nell'Operations Center)
- Badge delle selezioni attive visualizzati come chip rimovibili

**Pannello destro (65%) — Dettaglio contestuale**
- Quando nessun ATECO selezionato: overview globale con statistiche (totale prospect, con email, con PEC, fatturato medio, ecc.)
- Quando ATECO selezionato: lista dei prospect filtrati per quell'ATECO, con:
  - Ricerca interna per nome/citta'/provincia
  - Ordinamento per nome, fatturato, dipendenti
  - Card prospect con: nome azienda, citta' (provincia), fatturato, dipendenti, indicatori contatto
  - Click su prospect apre il dettaglio inline (come il PartnerDetail nel Partner Hub) con tutti i dati: anagrafica, contatti, dati finanziari, ATECO, rating, contatti personali dalla tabella `prospect_contacts`

### File da creare

1. **`src/pages/ProspectCenter.tsx`** — Pagina principale con layout 35/65, barra stats, tema dark/light
2. **`src/components/prospects/AtecoGrid.tsx`** — Pannello sinistro con lista codici ATECO, ricerca, filtri, multi-selezione
3. **`src/components/prospects/ProspectListPanel.tsx`** — Pannello destro con lista prospect filtrati e dettaglio inline
4. **`src/hooks/useProspectStats.ts`** — Hook per statistiche aggregate (count per ATECO, per regione, totali)

### File da modificare

5. **`src/App.tsx`** — Sostituire la rotta `/prospects` per puntare a `ProspectCenter` invece di `Prospects`
6. **`src/components/layout/AppSidebar.tsx`** — Aggiornare il label da "Prospect" a "Prospect Center" (opzionale)

### Dettaglio tecnico

**AtecoGrid** (modello: CountryGrid)
- Query: `SELECT codice_ateco, descrizione_ateco, COUNT(*) as cnt, COUNT(email) as with_email, COUNT(pec) as with_pec, AVG(fatturato) as avg_fatturato FROM prospects WHERE codice_ateco IS NOT NULL GROUP BY codice_ateco, descrizione_ateco ORDER BY codice_ateco`
- Raggruppamento gerarchico: le prime 2 cifre del codice ATECO definiscono la "sezione" (es. 46.xx = Commercio ingrosso). I sotto-codici (46.11, 46.12...) sono figli
- Card con accent stripe colorata in base alla densita' dati
- Filtri aggiuntivi nel dropdown: regione e provincia (query dinamica sui prospect per ATECO selezionato)

**ProspectListPanel** (modello: PartnerListPanel)
- Riceve i codici ATECO selezionati come prop
- Query: `SELECT * FROM prospects WHERE codice_ateco IN (...) ORDER BY company_name`
- Se si aggiungono filtri regione/provincia dal pannello sinistro, li applica anche qui
- Dettaglio prospect inline con sezioni: Anagrafica, Contatti (da `prospect_contacts`), Dati Finanziari, Informazioni Legali
- Indicatore qualita' contatto: verde se ha email + telefono, giallo se parziale, rosso se mancante

**ProspectCenter** (modello: Operations.tsx)
- Barra stats globale: Totale Prospect, Con Email, Con PEC, Fatturato Medio, Settori ATECO
- Supporto tema dark/light con lo stesso sistema ThemeCtx
- Nessun tab aggiuntivo per ora (solo lista prospect), ma la struttura e' predisposta per aggiungere tab come "Importa" o "Campagne" in futuro

### Gestione dati vuoti

Dato che il database e' ancora vuoto, la pagina mostrera' uno stato empty con istruzioni su come importare prospect tramite l'estensione Chrome RA. Quando i dati saranno disponibili, la griglia ATECO e la lista si popoleranno automaticamente.

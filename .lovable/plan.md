

## Rubrica Partner — Redesign Completo

### Problemi identificati
1. **Limite 2000** nelle query `usePartners` e `usePartnersByCountry`
2. **Chatbot (AI)** posizionato solo nel header della Rubrica, non accessibile globalmente
3. **Contatore partner per paese** poco evidente nella Country Cards
4. **Filtri nel Country Workbench** non mostrano quanti partner sono visibili vs totali
5. **Nessun numero progressivo** nella lista partner del paese
6. **Card partner (lista sinistra)** disordinata, troppe informazioni mescolate
7. **Card dettaglio (pannello destro)** — loghi network piccolissimi, troppi colori diversi, dati chiave (anni WCA, expiration, network count) non immediati
8. **Palette colori** eccessiva — servono max 3 colori funzionali

---

### Piano di implementazione

#### 1. Rimuovere limiti query
**File:** `src/hooks/usePartners.ts`
- Rimuovere `.limit(2000)` da `usePartners` (riga ~79) e `usePartnersByCountry` (riga ~97)
- Rimuovere `.limit(5000)` da `usePartnerStats` (riga ~113)
- Implementare paginazione con `range()` per caricare a blocchi di 1000 (il default Supabase) iterando fino a esaurimento

#### 2. AI Assistant globale
**File:** `src/components/layout/AppLayout.tsx`
- Aggiungere un bottone AI fisso (icona Bot) nell'header globale dell'app, sempre visibile
- Il bottone apre `AiAssistantDialog` con contesto dalla pagina corrente

**File:** `src/pages/PartnerHub.tsx`
- Rimuovere il bottone Bot dal header locale della Rubrica (righe 292-304) poiché ora è globale

#### 3. Country Cards — contatore partner ben evidente
**File:** `src/components/partners/CountryCards.tsx`
- Il contatore è già presente (riga 121-122) ma va reso più grande e prominente
- Badge numerico grande, font-bold, colore primario, allineato a destra

#### 4. Country Workbench — contatore filtrato vs totale + numero progressivo
**File:** `src/components/partners/CountryWorkbench.tsx`
- Riga 215: cambiare da `"{filteredPartners.length} risultati"` a `"{filteredPartners.length} / {countryPartners.length} partner"`
- Aggiungere numero progressivo (index + 1) prima di ogni card nella lista

#### 5. Card partner lista (sinistra) — pulizia e ordine
**File:** `src/components/partners/CountryWorkbench.tsx` (card inline, righe 244-374)
**File:** `src/components/partners/PartnerListItem.tsx` (vista lista)

Struttura card pulita:
```text
┌──────────────────────────────────────┐
│ #1  [Logo]  COMPANY NAME    ★★★☆☆  │
│            City · 🏆 12 yrs         │
│            ✉ email  📞 phone        │
│            [service icons]          │
│            [network badges]         │
└──────────────────────────────────────┘
```

- Numero progressivo a sinistra
- Logo + nome azienda in grassetto
- Sotto: città + anni WCA
- Sotto: email e telefono del contatto primario (sempre visibili, non solo on hover)
- Sotto: icone servizi compatte
- Network badges compatti
- Eliminare le quick actions on-hover (confondono), i contatti sono già visibili
- **Max 3 colori**: foreground (testo), sky-400 (email/links), emerald-400 (telefono)

#### 6. Dettaglio partner (pannello destro) — pulizia
**File:** `src/components/partners/PartnerDetailFull.tsx`

Modifiche principali:
- **Network bar** (riga 244-267): aumentare dimensione loghi da `h-6` a `h-10`, aggiungere nome network sotto il logo come fallback più leggibile
- **Info chiave in evidenza** — creare una sezione "Anagrafica" chiara con:
  - Anni WCA (grande e leggibile)
  - Data scadenza membership (con alert se vicina)
  - Numero network attivi
  - Rating con stelle grandi
- **Riduzione colori**: eliminare bordi colorati diversi per ogni sezione. Usare un solo bordo `border-border/40` per tutte le card. Colori solo per:
  - **Sky-400**: informazioni di contatto (email, telefono, website)
  - **Emerald-400**: stati positivi (certificazioni, contatti completi)
  - **Amber-400**: membership/rating/trofei
- **KPI cards** (riga 122-129): ridurre da 6 colori diversi a palette uniforme, usando solo i 3 colori sopra
- **Sezioni contatti**: rendere email e telefono più grandi e leggibili (text-sm invece di text-[10px])

#### 7. Palette colori unificata (max 3)
Applicare in tutti i componenti partner:
- **Sky/Blue**: comunicazione (email, website, LinkedIn)
- **Emerald/Green**: telefono, WhatsApp, stati positivi
- **Amber**: membership, rating, trofei, alert scadenze

Rimuovere: violet, rose, primary varianti per bordi sezione.

---

### File coinvolti
1. `src/hooks/usePartners.ts` — rimozione limiti + paginazione
2. `src/components/layout/AppLayout.tsx` — AI button globale
3. `src/pages/PartnerHub.tsx` — rimozione AI locale
4. `src/components/partners/CountryCards.tsx` — contatore prominente
5. `src/components/partners/CountryWorkbench.tsx` — filtrato/totale, progressivo, card pulita
6. `src/components/partners/PartnerListItem.tsx` — card pulita vista lista
7. `src/components/partners/PartnerDetailFull.tsx` — loghi network grandi, colori uniformi, info chiave


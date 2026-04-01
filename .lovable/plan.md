

# Ottimizzazioni Cockpit: LinkedIn Smart + Drop Zone Migliorate

## 3 interventi

### 1. LinkedIn: skip ricerca se URL già presente, lettura profilo diretta

Quando si fa drop su LinkedIn e il contatto ha già `enrichment_data.linkedin_url` o `linkedinUrl`:
- **Non cercare** il profilo (skip fase "searching")
- **Vai diretto** a leggere il profilo (`extractProfile`) per raccogliere headline, about, location
- Mostra i dati estratti nella fase "reviewing" come già avviene
- L'utente poi decide se generare il messaggio o approfondire con Deep Search

**File**: `src/pages/Cockpit.tsx` (linee 252-290) — aggiungere check `if (linkedinUrl)` per saltare la ricerca e andare diretto a "visiting"

### 2. Pulsante "Leggi Profilo / Deep Search" sopra le Drop Zone

Aggiungere una **barra azioni rapide** sopra i 4 riquadri canale con:
- **"📖 Leggi Profilo"** — fa solo scraping del profilo LinkedIn senza generare messaggio (usa URL esistente o cerca)
- **"🔍 Deep Search"** — lancia la deep search completa

Questi pulsanti si attivano quando c'è un contatto in drag o selezionato. Visibili solo quando la sezione drop zone è attiva (non in batch mode / LinkedIn flow).

**File**: `src/components/cockpit/ChannelDropZones.tsx` — aggiungere sezione sopra i canali
**File**: `src/pages/Cockpit.tsx` — passare callbacks per le nuove azioni

### 3. Drop Zone molto più grandi e robuste

Problemi attuali visibili dallo screenshot:
- Le zone sono `p-5` con `max-w-[240px]` — troppo piccole rispetto alle card
- Il drag non dà sicurezza visiva
- La card draggata è più grande dell'area target

Modifiche a `ChannelDropZones.tsx`:
- Rimuovere `max-w-[240px]` → le zone riempiono tutto lo spazio disponibile
- Aumentare altezza minima a `min-h-[80px]` (almeno quanto una card contatto)
- Aumentare padding a `p-6`
- Icone più grandi (`w-8 h-8` invece di `w-6 h-6`)
- Testo più grande (`text-lg` invece di `text-base`)
- Bordo più visibile durante il drag (`border-3`)
- Effetto hover più evidente: sfondo colorato per canale (blu LinkedIn, verde WhatsApp, etc.) invece del blu uniforme
- Aggiungere testo helper "Rilascia qui" quando si trascina sopra

## File modificati

| File | Cosa |
|------|------|
| `src/pages/Cockpit.tsx` | Skip ricerca LinkedIn se URL presente; passare callbacks profilo/deep search |
| `src/components/cockpit/ChannelDropZones.tsx` | Zone molto più grandi; barra azioni sopra; colori per canale; feedback "Rilascia qui" |


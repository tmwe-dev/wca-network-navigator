

# REBUILDING - Partner Hub Glassmorphism Redesign

## Obiettivo
Trasformare il Partner Hub in un'interfaccia con stile glassmorphism (simile alla pagina Campaigns), layout a due colonne nel pannello destro, icone grandi, sezioni collassabili, ordinamenti nella lista sinistra, e bandiere/icone prominenti ovunque.

## FASE 1 - Stile Glassmorphism e Layout Base

### Sfondo e pannelli
- Il pannello destro (dettaglio) adotta lo stile glassmorphism: sfondo con gradiente scuro, card con `backdrop-blur-xl bg-white/5 border border-white/10` (simile a `.space-panel`)
- Il pannello sinistro (lista) mantiene un look piu' pulito ma con leggere trasparenze
- Aggiungere classi CSS dedicate in `src/index.css` per il glassmorphism del Partner Hub (es. `.glass-card`, `.glass-surface`)

### File: `src/index.css`
Aggiungere classi:
- `.glass-card` - card con backdrop-blur, bordo semi-trasparente, sfondo semi-trasparente
- `.glass-surface` - sfondo con gradiente scuro per il pannello dettaglio
- `.glass-badge` - badge con sfondo blur

---

## FASE 2 - Pannello Sinistro (Lista Partner)

### Card partner nella lista
Ogni card mostra:
- Logo (o box vuoto se mancante)
- Nome azienda in grassetto
- Citta' e Paese su due righe separate (citta' in grassetto, bandiera 3x piu' grande)
- Stelle rating (5 stelle, mezze stelle gialle)
- Coppe piene per anni
- Icone contatto (Phone verde, Mail blu, WhatsApp verde) se disponibili
- Riga di bandiere affiancate dei paesi dove hanno branch offices
- Riga di icone servizi principali (Plane, Ship, Truck ecc.)
- Striscia laterale colorata per qualita' contatti

### Ordinamenti (sotto la barra di ricerca)
Aggiungere un selettore di ordinamento con le opzioni:
- Nome (A-Z / Z-A)
- Rating (alto-basso)
- Anni WCA (piu'-meno)
- Paese (A-Z)
- Numero branch (piu'-meno)
- Qualita' contatti (completi prima)

Implementato come un `Select` compatto accanto al filtro esistente.

### File: `src/pages/PartnerHub.tsx` - sezione lista

---

## FASE 3 - Pannello Destro (Dettaglio) - Layout a 2 Colonne

Il dettaglio viene riorganizzato in un layout a due colonne dentro il contenitore:

### Colonna Sinistra (60%) - Informazioni Principali

**Header compatto (3 righe):**
1. Nome azienda + WCA ID
2. Citta' (grassetto) su una riga, Paese su seconda riga, bandiera 3x grande
3. Icona grande per tipo (es. Truck per Freight Forwarder) + stelle + coppe

**Sezione "Servizi" (icone grandi, raggruppate):**
- Gruppo "Transport": Ocean FCL + LCL affiancati (icona Ship grande), Road Freight (Truck), Rail (Train), Air (Plane), Project Cargo (Package) -- layout a griglia 2 colonne
- Ogni servizio ha icona grande (w-8 h-8) colorata + nome sotto

**Sezione "Specialita'" (verticale):**
- Dangerous Goods (AlertTriangle, arancione)
- Perishables (Snowflake, azzurro)
- Pharma (Pill, viola)
- E-commerce (ShoppingCart, verde)
- Ognuno con icona grande + nome accanto, layout verticale

**Contatti Azienda (collapsible):**
- Icona grande (Building2) come trigger
- Quando aperto: telefono, email, sito, indirizzo
- Chiuso di default: si vede solo l'icona

**Contatti Ufficio (collapsible):**
- Icona grande (Users) come trigger
- Quando aperto: lista contatti con nome, ruolo, email, telefono
- Chiuso di default

**Profilo Aziendale (collapsible):**
- Icona grande (FileText) come trigger
- Dentro: descrizione + icone specialita' + paesi branch con bandiere + routing principali

### Colonna Destra (40%) - Dettagli e Metadati

**Social Links:**
- Icone grandi dei social (LinkedIn blu grande, Facebook, Instagram, Twitter, WhatsApp)
- Ogni icona e' un link cliccabile
- Nome del social sotto l'icona

**Paesi Collegati (Branch):**
- Griglia di bandiere grandi con nome paese sotto
- Ogni bandiera rappresenta un paese dove hanno uffici

**Mercati Principali:**
- Bandiere grandi dei paesi/continenti serviti
- Estratti dai dati di enrichment (`key_markets`)
- Se disponibile, mini-mappa 2D del continente (usando un semplice SVG o emoji continente)

**Network WCA:**
- Logo grande di ogni network (immagine se disponibile, altrimenti badge con nome)
- Nome del network sotto il logo
- Data scadenza se presente

**Certificazioni:**
- Badge grandi con icona (ShieldCheck) + nome certificazione
- Layout verticale

**KPI Badges:**
- Mantiene il layout attuale ma con stile glass

---

## FASE 4 - Icone e Visuali

### Mapping icone servizi (grandi, colorate)
| Servizio | Icona | Colore |
|----------|-------|--------|
| Air Freight | Plane | sky-500 |
| Ocean FCL | Ship | blue-500 |
| Ocean LCL | Ship | blue-400 |
| Road Freight | Truck | amber-500 |
| Rail Freight | TrainFront | slate-500 |
| Project Cargo | Package | orange-500 |
| Dangerous Goods | AlertTriangle | red-500 |
| Perishables | Snowflake | cyan-400 |
| Pharma | Pill | purple-500 |
| E-commerce | ShoppingCart | green-500 |
| Relocations | Home | teal-500 |
| Customs Broker | FileCheck | indigo-500 |
| Warehousing | Warehouse | stone-500 |
| NVOCC | Anchor | navy/slate-600 |

### Mapping icone tipo partner
| Tipo | Icona |
|------|-------|
| Freight Forwarder | Truck (grande) |
| Customs Broker | FileCheck |
| Carrier | Ship |
| NVOCC | Anchor |
| 3PL | Warehouse |
| Courier | Package |

### Rating "High Quality" (spiegazione)
Aggiungere un tooltip al rating che spiega il breakdown: "Valutazione basata su: anzianita' WCA, numero filiali, completezza profilo, certificazioni, infrastrutture proprie"

---

## FASE 5 - Dettagli Tecnici

### File modificati

| File | Modifiche |
|------|-----------|
| `src/index.css` | Aggiungere classi `.glass-card`, `.glass-surface`, `.glass-badge` |
| `src/pages/PartnerHub.tsx` | Riscrittura completa del `PartnerDetail` con layout 2 colonne, glassmorphism, icone grandi, sezioni collapsible. Aggiunta ordinamenti nella lista. Card lista arricchite con bandiere branch e icone servizi |
| `src/lib/countries.ts` | Aggiungere `getPartnerTypeIcon()` che mappa tipo partner a icona. Aggiungere `getServiceIconColor()` per colori dedicati per servizio |
| `src/components/agents/SocialLinks.tsx` | Variante "large" con icone grandi e nome sotto |
| `src/components/agents/KpiBadges.tsx` | Variante glass style |

### Ordinamento lista
Nuovo state `sortBy` con opzioni: `name_asc`, `name_desc`, `rating_desc`, `years_desc`, `country_asc`, `branches_desc`, `contacts_desc`. Applicato con `useMemo` sulla lista filtrata.

### Collapsible sections
Usare il componente `Collapsible` gia' presente per Contatti Azienda, Contatti Ufficio e Profilo Aziendale. Trigger: icona grande + titolo. Contenuto nascosto di default.

### Bandiere nella lista
Per ogni partner nella lista, estrarre i branch countries e mostrare una riga di emoji bandiera (testo grande) affiancate. Massimo 8 bandiere visibili, poi "+N".


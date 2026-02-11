
## Pagina Unificata "Partner" - Ibrido Dashboard + Agenti + Dettaglio

### Cosa viene eliminato
- La pagina **Dashboard** (`/`) viene sostituita dalla nuova pagina unificata che diventa la home
- La pagina **Partners** (`/partners`) viene eliminata (duplicato)
- La pagina **Agenti** (`/agents`) viene eliminata (assorbita)
- La pagina **PartnerDetail** (`/partners/:id`) viene eliminata (il dettaglio si apre inline)
- Dalla sidebar spariscono le voci "Dashboard", "Agenti" e "Partners" e ne resta una sola: **"Partner"**

### La nuova pagina: layout master-detail

```text
+----------------------------------------------+----------------------------------------+
| LISTA PARTNER (40%)                          | DETTAGLIO PARTNER (60%)                |
|                                              |                                        |
| [Cerca...]  [Filtri] [Solo incompleti]       |  +------+ ACME Logistics Ltd           |
|                                              |  | LOGO | Milano, Italia 🇮🇹             |
| 1.247 partner                                |  +------+ ★★★★☆ 4.2  FF  HQ  8a WCA   |
|                                              |                                        |
| +------------------------------------------+|  [KPI badges: Anni, Filiali, Paesi]    |
| | 🇮🇹 ACME Logistics          ★ 4.2  ✓OK  ||  [Social links]                        |
| |    Milano · FF · 8a  · ✉️📞             ||                                        |
| +------------------------------------------+|  +--LEFT COL-----+  +--RIGHT COL-----+ |
| | 🇩🇪 Berlin Freight          ★ 3.8  ⚠️  ||  | Contatti       |  | 🌍 MINI GLOBO  | |
| |    Berlin · FF · 12a · ✉️               ||  | ☎ +39 02 xxx  |  | con 3 marker   | |
| +------------------------------------------+|  | ✉ info@...    |  | IT, US, BR     | |
|                                              |  | 🌐 acme.com   |  |                | |
|                                              |  +---------------+  +----------------+ |
|                                              |                                        |
|                                              |  Servizi: [Air] [Sea] [Express]         |
|                                              |                                        |
|                                              |  Contatti Ufficio                       |
|                                              |  Mario Rossi · CEO                      |
|                                              |  mario@acme.com · +39 333 xxx          |
|                                              |  [LinkedIn]                             |
|                                              |                                        |
|                                              |  ▸ Profilo aziendale (collapsible)      |
|                                              |  ▸ Dati dal sito web (enrichment)       |
|                                              |                                        |
|                                              |  Network: WCA Gold · FIATA              |
|                                              |  Certificazioni: IATA · ISO 9001        |
|                                              |                                        |
|                                              |  Timeline CRM (interazioni + attivita') |
|                                              |  Promemoria                             |
+----------------------------------------------+----------------------------------------+
```

### Elementi chiave del dettaglio

**Header partner:**
- Logo aziendale (da `logo_url` o favicon) con bandiera sovrapposta come badge
- Nome, citta', paese, badge tipo (FF/Broker/HQ/Branch)
- Rating stellare, KPI badges (anni WCA, filiali, paesi, certificazioni, gold)
- Social links (LinkedIn, etc.)
- Pulsanti: Favorito, Deep Search, Analisi AI

**Mini-globo 3D (angolo in alto a destra del dettaglio):**
- Un globo compatto (~200x200px) che usa il componente StandaloneGlobe
- Mostra marker solo per i paesi dove l'azienda ha filiali (da `branch_cities`)
- Marker sulla sede principale + marker sulle citta' delle filiali
- Si vede solo se il partner ha filiali in altri paesi

**Contatti ufficio (sezione dedicata, NO pulsanti nascosti):**
- Ogni contatto mostra: nome, titolo, email (testo visibile), telefono (testo visibile), mobile
- Link social accanto a ogni contatto
- Badge "Primary" per il contatto principale

**Descrizione e arricchimento:**
- Profilo aziendale in un collapsible (aperto di default se breve)
- EnrichmentCard (dati dal sito web) in un collapsible

**CRM:**
- Timeline interazioni + lista attivita' + promemoria, tutto in fondo

### Dettagli tecnici

**File creati:**
- `src/pages/PartnerHub.tsx` - La nuova pagina unificata (layout master-detail)
- `src/components/partners/PartnerMiniGlobe.tsx` - Wrapper del globo 3D in formato compatto per il dettaglio partner

**File modificati:**
- `src/App.tsx` - Rotte: `/` e `/partners` puntano a PartnerHub, rimosse `/agents` e `/partners/:id`
- `src/components/layout/AppSidebar.tsx` - Sidebar: una sola voce "Partner" al posto di Dashboard + Agenti + Partners

**File che restano ma non vengono piu' usati nelle rotte:**
- `src/pages/Dashboard.tsx`, `src/pages/Partners.tsx`, `src/pages/Agents.tsx`, `src/pages/PartnerDetail.tsx` - Non eliminati fisicamente per sicurezza, ma rimossi dalle rotte

**Componenti riutilizzati senza modifiche:**
- `KpiBadges`, `EnrichmentCard`, `SocialLinks`, `BulkActionBar`, `AssignActivityDialog`, `ActivityList`, `PartnerRating`, `PartnerFiltersSheet`

**Dati:**
- La lista usa `usePartners()` (gia' esistente, include contatti e servizi nella select)
- Il dettaglio usa `usePartner(id)` (gia' esistente, include tutto: contatti, interazioni, servizi, network, certificazioni, promemoria)
- Il mini-globo riceve i dati da `branch_cities` del partner e la sede principale, costruendo un array di `CountryWithPartners` per i soli paesi rilevanti

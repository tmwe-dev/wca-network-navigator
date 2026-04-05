## Piano: Sidebar Potenti + Card Cockpit Arricchite

### Parte 1 — CockpitContactCard: Bandiera + Dati Anagrafici

La card del Cockpit mostrerà:
- **Bandiera paese** (emoji) accanto al nome — già disponibile come `flag` prop ma poco visibile
- **Anni di anzianità** (calcolati da `member_since` del partner) — es. "Membro da 8 anni"
- **Network di appartenenza** (da `enrichment_data` o dalla tabella `partners`)
- **Seniority del contatto** (da `enrichment_data.contact_profile.seniority`)
- **Specializzazioni** (da `enrichment_data.company_profile.specialties`)
- **Ultimo contatto** più visibile con data

Per fare questo:
1. Estendere `CockpitContact` interface con `memberSince`, `networks`
2. Nel hook `useCockpitContacts`, mappare `member_since` dal partner
3. Aggiornare la card per mostrare queste info in modo compatto

---

### Parte 2 — Audit Sidebar per Pagina

| Pagina | Ha VerticalTabNav? | FilterSlot attuale | Stato |
|---|---|---|---|
| **Outreach** (Cockpit, InUscita, Attività, Circuito, Email, WA, LI) | ✅ | `OutreachFilterSlot` — Solo cerca + ordina + origine (3 chip) | **Da potenziare** |
| **CRM** (Contatti, Biglietti) | ✅ | `CRMFilterSlot` — Cerca + raggruppa + ordina + stato lead + circuito | ✅ Già buono |
| **Network** (Operations) | ❌ | Nessuna sidebar verticale — usa un header portal | **Da aggiungere** |
| **Settings** | ✅ | Solo per tab Enrichment | OK (non serve filtri) |

---

### Parte 3 — Potenziamento Sidebar Outreach (Cockpit)

La sidebar Cockpit attualmente ha solo: **Cerca**, **Ordina** (3 opzioni), **Origine** (3 chip).

Aggiungeremo:
- **Filtro Paese** — multiselect con emoji bandiere, conta contatti per paese
- **Filtro Canale** — Con email / Con LinkedIn / Con WhatsApp / Con telefono
- **Filtro Stato** — Nuovo / Contattato / In corso / Trattativa / Convertito
- **Filtro Qualità** — Arricchiti / Non arricchiti / Con alias / Senza alias
- **Ordinamenti aggiuntivi** — Data aggiunta / Ultimo contatto / Priorità ↑↓
- **Contatore risultati** — "N contatti filtrati"

### Parte 4 — Sidebar per Network

Il Network (Operations) non ha VerticalTabNav. Aggiungeremo:
- Tab verticali: **Partners** / **BCA** 
- FilterSlot con: Cerca, Filtro paese, Ordinamento, Qualità dati (con email/tel/profilo)

### Parte 5 — Sidebar per Circuito, Email, WhatsApp, LinkedIn (Outreach tabs)

Ogni tab avrà filtri contestuali:
- **Circuito**: Filtro per fase (Contacted, In Progress, etc.) + Ordinamento per ultimo contatto
- **Email**: Filtro per letto/non letto + Categoria + Ordinamento data
- **WhatsApp/LinkedIn**: Filtro letto/non letto + ricerca

---

### Ordine di esecuzione
1. CockpitContactCard arricchita (bandiera, anzianità, network, seniority)
2. OutreachFilterSlot potenziata per Cockpit
3. NetworkFilterSlot (nuova) per Operations  
4. Filtri contestuali per gli altri tab Outreach

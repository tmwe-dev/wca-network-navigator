
# Pulizia Completa — Pagina per Pagina

## Problema Principale

I filtri sono **duplicati in 3 posti**: VerticalTabNav sidebar interna, FiltersDrawer (linguetta lilla), e dentro le pagine stesse. Stesse costanti, stessi controlli, copiati ovunque.

## Pagina 1: Home (`/`)

**Da rimuovere:**
- Sezione "Prototipi UI — Scegli il layout" (3 bottoni prototipo inutili)
- Sezione "Stato del sistema" in fondo (ridondante con le nav cards)
- Import di `Layout`, `MessageSquare`, `Layers` non più usati

**Da tenere:** Saluto + AI Prompt, Briefing + Agenti, Job attivi, Nav cards

---

## Pagina 2: Network (`/network`)

**Già pulita** nella sessione precedente. Nessuna VerticalTabNav, filtri solo nella FiltersDrawer. OK.

---

## Pagina 3: Outreach (`/outreach`)

**Problema grave:** `OutreachFilterSlot.tsx` (473 righe!) nella VerticalTabNav contiene gli stessi identici filtri che sono già nella FiltersDrawer per la sezione Outreach.

**Azione:**
- **Rimuovere** `OutreachFilterSlot` dalla VerticalTabNav
- La VerticalTabNav resta SOLO come navigazione tab (Cockpit, In Uscita, Attività, Circuito, Email, WhatsApp, LinkedIn) — **senza `filterSlot`**
- I filtri restano SOLO nella FiltersDrawer
- Eliminare il file `src/components/filters/OutreachFilterSlot.tsx`

---

## Pagina 4: CRM (`/crm`)

**Stesso problema:** `CRMFilterSlot.tsx` (196 righe) duplica i filtri della FiltersDrawer.

**Azione:**
- Rimuovere `CRMFilterSlot` dalla VerticalTabNav
- La VerticalTabNav resta per navigare tra "Contatti" e "Biglietti" — senza filtri
- Eliminare il file `src/components/filters/CRMFilterSlot.tsx`

---

## Pagina 5: Agenda (`/agenda`)

**Non ha VerticalTabNav** — ha solo header con navigazione mese/settimana/giorno. Pulita. Ma manca una sezione dedicata nella FiltersDrawer.

**Azione:**
- Aggiungere sezione "Agenda" nella FiltersDrawer con: filtro tipo evento (reminder/activity), filtro priorità, filtro stato

---

## Pagina 6: Settings (`/settings`)

**Caso diverso:** qui la VerticalTabNav serve davvero come navigazione tra 10 pannelli di configurazione. I filtri enrichment nella sidebar sono specifici di quella sotto-pagina.

**Azione:** Lasciare com'è. Settings non è una pagina operativa.

---

## Pagina 7: Pagine legacy da eliminare

Queste route/pagine non sono più necessarie o sono duplicate:

| File | Motivo eliminazione |
|------|-------------------|
| `PrototypeA.tsx` | Prototipo sperimentale, mai usato |
| `PrototypeB.tsx` | Idem |
| `PrototypeC.tsx` | Idem |
| `SystemMap.tsx` | Diagnostica interna |
| `Agents.tsx` | Sostituito da AgentStatusPanel nella Home |
| `Dashboard.tsx` | Sostituito da SuperHome3D |
| `HubOperativo.tsx` | Legacy |
| `Global.tsx` | Legacy |

---

## Riepilogo Modifiche

| File | Azione |
|------|--------|
| `src/pages/SuperHome3D.tsx` | Rimuovere sezioni Prototipi e Stato Sistema |
| `src/pages/Outreach.tsx` | Rimuovere `filterSlot` dalla VerticalTabNav |
| `src/pages/CRM.tsx` | Rimuovere `filterSlot` dalla VerticalTabNav |
| `src/components/filters/OutreachFilterSlot.tsx` | **Eliminare** |
| `src/components/filters/CRMFilterSlot.tsx` | **Eliminare** |
| `src/components/global/FiltersDrawer.tsx` | Aggiungere sezione Agenda |
| `src/pages/Prototype*.tsx` | **Eliminare** (3 file) |
| `src/pages/Dashboard.tsx` | **Eliminare** |
| `src/pages/HubOperativo.tsx` | **Eliminare** |
| `src/pages/Global.tsx` | **Eliminare** |
| `src/pages/SystemMap.tsx` | **Eliminare** |
| `src/pages/Agents.tsx` | **Eliminare** |
| `src/App.tsx` | Rimuovere le route corrispondenti |

**Risultato:** Filtri in un unico posto (FiltersDrawer), VerticalTabNav solo per navigazione, niente più duplicazione, 8 file eliminati.

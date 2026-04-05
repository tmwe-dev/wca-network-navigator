

# Pulizia Completa — Pagina per Pagina

## Problema Principale

I filtri sono **duplicati in 3 posti**: VerticalTabNav sidebar interna, FiltersDrawer (linguetta lilla), e dentro le pagine stesse. Stesse costanti, stessi controlli, copiati ovunque.

## Pagina 1: Home (`/`)

**Da rimuovere:**
- Sezione "Prototipi UI — Scegli il layout" (3 bottoni prototipo)
- Sezione "Stato del sistema" in fondo (ridondante con le nav cards)
- Import inutilizzati (`Layout`, `MessageSquare`, `Layers`)

**Da tenere:** Saluto + AI Prompt, Briefing + Agenti, Job attivi, Nav cards

---

## Pagina 2: Network (`/network`)

Gia pulita nella sessione precedente. Nessuna VerticalTabNav, filtri solo nella FiltersDrawer.

---

## Pagina 3: Outreach (`/outreach`)

**Problema grave:** `OutreachFilterSlot.tsx` (473 righe!) nella VerticalTabNav contiene gli stessi identici filtri gia presenti nella FiltersDrawer.

**Azione:**
- Rimuovere `filterSlot` dalla VerticalTabNav
- La VerticalTabNav resta SOLO come navigazione tab (Cockpit, In Uscita, ecc.)
- Eliminare il file `OutreachFilterSlot.tsx`

---

## Pagina 4: CRM (`/crm`)

**Stesso problema:** `CRMFilterSlot.tsx` (196 righe) duplica i filtri della FiltersDrawer.

**Azione:**
- Rimuovere `filterSlot` dalla VerticalTabNav
- VerticalTabNav resta per navigare tra "Contatti" e "Biglietti"
- Eliminare il file `CRMFilterSlot.tsx`

---

## Pagina 5: Agenda (`/agenda`)

Non ha VerticalTabNav -- pulita. Ma manca nella FiltersDrawer.

**Azione:** Aggiungere sezione "Agenda" nella FiltersDrawer con filtro tipo evento, priorita e stato.

---

## Pagina 6: Settings (`/settings`)

La VerticalTabNav qui serve come navigazione tra 10 pannelli. Lasciare com'e'.

---

## Pagina 7: Pagine legacy da eliminare

| File | Motivo |
|------|--------|
| `PrototypeA/B/C.tsx` | Prototipi sperimentali non usati |
| `SystemMap.tsx` | Diagnostica interna |
| `Agents.tsx` | Sostituito da AgentStatusPanel |
| `Dashboard.tsx` | Sostituito da SuperHome3D |
| `HubOperativo.tsx` | Legacy |
| `Global.tsx` | Legacy |

---

## Riepilogo File

| File | Azione |
|------|--------|
| `SuperHome3D.tsx` | Rimuovere Prototipi + Stato Sistema |
| `Outreach.tsx` | Rimuovere filterSlot |
| `CRM.tsx` | Rimuovere filterSlot |
| `OutreachFilterSlot.tsx` | Eliminare |
| `CRMFilterSlot.tsx` | Eliminare |
| `FiltersDrawer.tsx` | Aggiungere sezione Agenda |
| 8 file legacy | Eliminare + rimuovere route da App.tsx |

**Risultato:** Filtri in un unico posto (FiltersDrawer), VerticalTabNav solo per navigazione, 8 file eliminati, zero duplicazione.


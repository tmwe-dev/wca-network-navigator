

## Country Workbench — Filtri per Servizio + Pulizia Card

### Cosa cambia

#### 1. Filtri in alto: aggiungere filtri per servizio
Sostituire il generico "con servizi" con filtri per ciascun servizio specifico. La toolbar dei filtri diventa:

```text
┌─────────────────────────────────────────────────────┐
│ Sort: [👤] [📍] [⭐] [🏆]  │  Filter: ✈2 🚢3 📦1 │
│                              │  🚛2 🚂0 ⚠1 ❄0 💊0 │
│                              │  [✕]                  │
└─────────────────────────────────────────────────────┘
```

- Rimuovere i filtri "with_phone", "with_email", "with_services" (non servono nella selezione azienda)
- Mantenere "deep_search" e "rating_3" come filtri generici
- Aggiungere un filtro per ogni servizio presente nel paese (dinamico): `air_freight`, `ocean_fcl`, `ocean_lcl`, `road_freight`, `rail_freight`, `project_cargo`, `dangerous_goods`, `perishables`, `pharma`, `ecommerce`, `relocations`, `customs_broker`, `warehousing`, `nvocc`
- Ogni filtro mostra l'icona del servizio + conteggio, cliccabile come toggle
- Filtri multipli = AND (partner deve avere TUTTI i servizi selezionati)
- Mostrare solo i servizi che hanno almeno 1 partner nel paese

#### 2. Card partner: due righe finali distinte
Nella card, non nascondere servizi e network:

```text
│ COMPANY NAME                           🏆 12  │
│ ⭐⭐⭐⭐☆ 4.2                                 │
│ 👤 Mario Rossi  +2                            │
│ ────────────────────────────────────────────── │
│ ✈ 🚢 📦 🚛 🚂 ⚠ ❄ 💊                        │  ← riga servizi (TUTTI, mai troncati)
│ InterGlobal · Projects · Pharma               │  ← riga network (TUTTI, mai troncati)
└────────────────────────────────────────────────┘
```

- **Servizi**: mostrare TUTTE le icone, non troncare a 5
- **Network**: riga separata sotto i servizi, mostrare TUTTI i nomi (non troncare a 2)
- Rimuovere email e telefono dalla card (sono nel dettaglio a destra)
- Contatti: solo nome contatto + badge "+N" se ce ne sono altri (icona Users con numero)

#### 3. Filtri servizio: logica
- Nuovo tipo `ServiceFilter` = chiave servizio (`air_freight`, etc.)
- Stato `activeServiceFilters: Set<string>`
- Un partner passa il filtro se ha TUTTI i servizi selezionati
- I conteggi dinamici mostrano quanti partner hanno quel servizio (considerando gli altri filtri attivi)

#### File coinvolto
- `src/components/partners/CountryWorkbench.tsx` — unico file


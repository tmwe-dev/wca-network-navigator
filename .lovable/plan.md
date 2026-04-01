

# Ristrutturazione Navigazione: Tab Verticali a Sinistra + Allineamento Card CRM

## Problema

1. **Tab orizzontali sotto l'header** occupano spazio verticale inutile in pagine come Outreach (5 tab), CRM (4 tab), Settings (7 tab). Questi tab vanno spostati in una **barra verticale sinistra compatta** (icone + label corte, ~48-56px di larghezza).

2. **ContactCard nel CRM** ha layout disallineato: dati sparsi, non incolonnati. Va allineato a sinistra con struttura tabellare coerente con le card del Cockpit (`CockpitContactListItem`).

## Pagine interessate dal cambio tab orizzontale → verticale

| Pagina | Tab attuali (orizzontali) |
|--------|--------------------------|
| `Outreach.tsx` | Cockpit, In Uscita, Attività, Circuito, Messaggi |
| `CRM.tsx` | Contatti, Import, Biglietti, Report Aziende |
| `Settings.tsx` | Generale, Contenuti, Connessioni, Import/Export, RA, Abbonamento, Voce AI |

Le pagine `Network` e `Global` non hanno sotto-tab orizzontali, quindi non sono toccate.

## Piano

### 1. Creare componente riusabile `VerticalTabNav`

Componente shared che riceve una lista di `{ value, label, icon, badge? }` e renderizza una barra verticale sinistra:
- Larghezza: ~52px collassata (solo icone), ~140px espansa (icona + label)
- Sfondo: `bg-muted/30`, bordo destro
- Tab attivo: highlight con sfondo `bg-primary/10` e barra laterale colorata
- Occupa l'intera altezza del contenuto

```text
┌──────────┬─────────────────────────────┐
│ 🚀 Cock  │                             │
│ ↑ Uscita │    Contenuto del tab        │
│ ☐ Attiv  │    selezionato              │
│ ✈ Circ   │                             │
│ 📥 Msg   │                             │
└──────────┴─────────────────────────────┘
```

### 2. Applicare `VerticalTabNav` a Outreach, CRM, Settings

Ogni pagina sostituisce la barra `<Tabs>` orizzontale con il layout `flex` orizzontale:
- Sinistra: `VerticalTabNav` con le stesse voci
- Destra: contenuto del tab selezionato (flex-1)
- Elimina il `<div>` con `border-b` che conteneva la TabsList orizzontale

### 3. Riallineare `ContactCard` nel CRM

La card contatti va ristrutturata per essere coerente con `CockpitContactListItem`:
- Layout a riga singola con colonne allineate a sinistra
- Checkbox | Azienda (truncate, larghezza fissa) | Contatto + ruolo | Città | Origine badge | Indicatori (LinkedIn, email, interazioni) a destra
- Rimuovere il layout multi-riga attuale con tooltip ovunque
- Tutto allineato a sinistra, incolonnato

## File modificati

| File | Modifica |
|------|----------|
| `src/components/ui/VerticalTabNav.tsx` | **Nuovo** — Componente riusabile tab verticali |
| `src/pages/Outreach.tsx` | Tab orizzontali → VerticalTabNav a sinistra |
| `src/pages/CRM.tsx` | Tab orizzontali → VerticalTabNav a sinistra |
| `src/pages/Settings.tsx` | Tab orizzontali → VerticalTabNav a sinistra |
| `src/components/contacts/ContactCard.tsx` | Layout riga singola allineato a sinistra, stile coerente con CockpitContactListItem |

## Risultato

- Guadagno di ~40px di spazio verticale su ogni pagina con sotto-tab
- Navigazione più chiara: orizzontale = sezioni principali (sidebar/header), verticale = sotto-sezioni
- Card contatti CRM allineate e leggibili come quelle del Cockpit


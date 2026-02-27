

## Riorganizzazione Badge Statistiche + Sincronizzazione Contatori

### Problema attuale
I badge in alto (Totale WCA, Scaricati, Senza Profilo, Senza Deep, ecc.) sono tutti allineati in un'unica riga orizzontale senza gerarchia. L'utente vuole una struttura a priorità visiva con separazione tra metriche primarie e secondarie.

### Layout proposto

```text
┌─────────────────────────────────────────────────────┐
│ 🇦🇱 Albania                                         │
│                                                     │
│ PRIMARI (riga 1):                                   │
│ ┌──────────┐ ┌──────────────┐                       │
│ │ Totale 11 │ │ Scaricati 11 │ 100%  [barra]        │
│ └──────────┘ └──────────────┘                       │
│                                                     │
│ QUALITÀ DATI (riga 2, due gruppi):                  │
│                                                     │
│ Completezza Contatti:          Arricchimento:        │
│ • Senza Profilo: 0 ✓          • Senza Deep: 3       │
│ • Senza Email: 1              • Senza Alias Az: 5   │
│ • Senza Telefono: 2           • Senza Alias Ct: 8   │
└─────────────────────────────────────────────────────┘
```

### Modifiche a `src/components/operations/PartnerListPanel.tsx`

**1. Riorganizzare la sezione badge (righe 384-397)**:
- **Riga primaria**: Totale WCA + Scaricati/Totale con percentuale e barra di progresso compatta
- **Riga secondaria sinistra** ("Completezza Contatti"): Senza Profilo, Senza Email, Senza Telefono — cliccabili come filtri
- **Riga secondaria destra** ("Arricchimento"): Senza Deep Search, Senza Alias Azienda, Senza Alias Contatti — cliccabili come filtri

**2. Sincronizzazione contatori in tempo reale**:
- Aggiungere invalidazione delle query keys `no-profile-wca-ids`, `db-partners-for-countries` e `partners` nel loop periodico di `useDownloadProcessor.ts` (riga 256-260), oltre alle già presenti `contact-completeness`, `country-stats`
- Questo garantisce che dopo ogni 5 profili scaricati, tutti i contatori (profilo, email, telefono, alias) si aggiornino live

### File da modificare

| File | Azione |
|------|--------|
| `src/components/operations/PartnerListPanel.tsx` | Riorganizzare layout badge in primari/secondari con due gruppi |
| `src/hooks/useDownloadProcessor.ts` | Aggiungere invalidazione query keys mancanti per sync real-time |


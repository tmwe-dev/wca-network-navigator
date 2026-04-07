

# Rimozione Bottoni Download/Export dalla Piattaforma

## Obiettivo
Eliminare tutti i punti dove un dipendente può scaricare dati dal database in locale (CSV, JSON, PDF), mantenendo solo le funzionalità di import (caricare dati dentro il sistema).

## Punti di download identificati

| # | File | Cosa fa | Azione |
|---|------|---------|--------|
| 1 | `ImportExportSettings.tsx` | Tab "Esporta" con export CSV/JSON/PDF dei partner | Rimuovere intero tab "Esporta" e relativo codice |
| 2 | `Import.tsx` | Bottone "Esporta CSV incompleti" durante import | Rimuovere bottone |
| 3 | `ImportErrorMonitor.tsx` | Bottone "Esporta CSV errori" | Rimuovere bottone |
| 4 | `useImportWizard.ts` | Funzione `handleExportIncomplete` | Rimuovere funzione |

### NON toccati (sono funzionalità operative, non export dati):
- **Download allegati email** (`EmailDetailView.tsx`) — scaricare un allegato ricevuto non è export del DB
- **Download estensione WhatsApp** (`ExtensionsTab.tsx`, `ChannelsTab.tsx`) — è un file di sistema, non dati
- **Download WCA/scraper** (`WCAScraper`) — è import dati dentro il sistema, non export fuori

## Modifiche

| File | Modifica |
|------|----------|
| `src/components/settings/ImportExportSettings.tsx` | Rimuovere tab "Esporta", funzioni `exportCSV`, `exportJSON`, `downloadBlob`. Rinominare componente in `ImportSettings` |
| `src/pages/Settings.tsx` | Aggiornare label tab da "Import/Export" a "Importa" |
| `src/pages/Import.tsx` | Rimuovere bottone "Esporta CSV incompleti" |
| `src/components/import/ImportErrorMonitor.tsx` | Rimuovere bottone "Esporta CSV errori" e funzione `exportErrorsToCSV` |
| `src/hooks/useImportWizard.ts` | Rimuovere `handleExportIncomplete` |

Nessun file nuovo. 5 file modificati.


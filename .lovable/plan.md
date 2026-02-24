

# Aggiornamento Guida Progetto + Pulizia Codice Deprecato

## Parte 1: Aggiornamento completo della Guida

La guida attuale e' molto datata e non riflette le funzionalita' reali del progetto. Verra' riscritta completamente con tutte le sezioni corrispondenti alle pagine nella sidebar.

**File: `src/pages/Guida.tsx`**

Le sezioni aggiornate saranno:

| Sezione | Icona | Contenuto |
|---------|-------|-----------|
| **Operations** | Globe | Dashboard centrale con griglia paesi, statistiche globali (partner, email, telefoni, profili, directory), job di download in background, terminale live, pannello partner per paese, strumenti avanzati (resync, WCA browser), assistente AI integrato |
| **Partner Hub** | Users | Navigazione a 3 livelli (paesi → workbench paese → lista flat), filtri avanzati (network, certificazioni, servizi, rating, anni WCA, scadenza membership), Deep Search bulk con progresso, selezione multipla con azioni (email, attivita workspace, deep search), dettaglio partner completo con contatti, social, rating, servizi |
| **Campaigns** | Mail | Globo 3D interattivo per selezione partner per paese, filtro network, invio batch a Campaign Jobs, preview email personalizzata |
| **Email Composer** | Send | Composizione email HTML con variabili dinamiche (company_name, contact_name, city, country), selezione destinatari per paese/partner/batch, allegati da template, link personalizzati, anteprima live, invio diretto SMTP |
| **Email Workspace** | Sparkles | Generazione email AI personalizzate, lista contatti con indicatori arricchimento (enriched/website/LinkedIn), Deep Search integrata con progresso e stop, eliminazione bulk attivita, filtri (enriched/non enriched, paese, tipo), barra obiettivo con documenti di riferimento e link |
| **Prospect Center** | Building2 | Gestione prospect italiani da Report Aziende, griglia ATECO interattiva con ranking, filtri avanzati (fatturato, dipendenti, regione, provincia), importazione automatica tramite estensione Chrome, ricerca rapida per nome/P.IVA |
| **Agenda** | Calendar | Calendario con vista mensile, reminder con priorita e scadenza, tab attivita con gestione batch, collegamento diretto a partner, completamento con un click |
| **Impostazioni** | Settings | 9 tab: Generale (WhatsApp), Email (SMTP + test invio), Connessioni (WCA credenziali + estensione + LinkedIn credenziali + estensione + cookie manuale), Import/Export (CSV/JSON con selezione campi), Blacklist (gestione aziende escluse), Report Aziende (credenziali + estensione), Template (upload allegati per categoria), Profilo AI (personalizzazione tono e stile), Abbonamento (piano e crediti) |

Inoltre verra aggiunta una sezione **Estensioni Chrome** che documenta le 3 estensioni:
- WCA World (login + cookie + scraping directory)
- LinkedIn (login + cookie + estrazione profili)
- Report Aziende (login + scraping prospect)

E una sezione **Deep Search** che spiega il flusso di arricchimento: scoperta sito web (da email o Firecrawl), scraping sito, analisi AI, logo (Google Favicon API), link WhatsApp automatico.

## Parte 2: Pulizia codice deprecato

File e codice da rimuovere perche' non piu' utilizzati:

| File | Motivo |
|------|--------|
| `src/pages/Prospects.tsx` | Sostituito da `ProspectCenter.tsx` — non importato da nessuna parte, non ha route in App.tsx |
| `src/hooks/useScrapingSettings.old.ts` | Versione vecchia, sostituita da `useScrapingSettings.ts` (shim con valori fissi) |
| `src/hooks/useDownloadProcessor.old.ts` | Versione vecchia, sostituita da `useDownloadProcessor.ts` |
| `src/components/settings/ScrapingSettings.old.tsx` | Tab scraping rimossa dalle impostazioni |
| `src/backup/` (intera cartella) | Backup manuale datato febbraio 2026, non referenziato |
| `DELAY_VALUES` e `DELAY_LABELS` in `theme.ts` | Marcati `@deprecated`, mai usati altrove — rimuovere le 2 righe |

## Riepilogo file modificati

| File | Azione |
|------|--------|
| `src/pages/Guida.tsx` | Riscrittura completa con tutte le sezioni aggiornate |
| `src/pages/Prospects.tsx` | Eliminazione |
| `src/hooks/useScrapingSettings.old.ts` | Eliminazione |
| `src/hooks/useDownloadProcessor.old.ts` | Eliminazione |
| `src/components/settings/ScrapingSettings.old.tsx` | Eliminazione |
| `src/backup/` | Eliminazione intera cartella (11 file) |
| `src/components/download/theme.ts` | Rimozione 2 costanti `@deprecated` |


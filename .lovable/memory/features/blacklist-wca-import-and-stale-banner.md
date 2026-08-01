---
name: Blacklist WCA Workflow
description: Import file BlackListExport WCA, sniff CSV vs XLSX, soglia 30g, banner globale top, badge ShieldAlert su CompanyCard + BCA
type: feature
---
- File `BlackListExport-*.xls` di WCA è in realtà CSV con BOM UTF-8: parser in `BlacklistManager.tsx` fa sniff binario (PK/D0CF/BOM/sample) e tratta come CSV anche con estensione .xls.
- Soglia refresh: 30 giorni (costante `BLACKLIST_REFRESH_DAYS`). Card stats mostra "scaduta da Xg" / "in scadenza tra Yg" / "prossimo aggiornamento tra Zg".
- Banner globale `BlacklistStaleBanner` in AuthenticatedLayout (solo desktop, top): si mostra se >30g o se ci sono entry ma nessun log; CTA → /v2/settings?tab=connessioni.
- Hook `useBlacklistedPartnerIds()` e `useBlacklistedCompanyNames()` (DAL `getBlacklistedPartnerIds`/`getBlacklistedCompanyNames`) restituiscono Set, staleTime 5min, no N+1 sulle liste.
- Badge "Blacklist" rosso (ShieldAlert) su `CompanyCard` (tutte le card partner) e su `BusinessCardsViewV2` (biglietti BCA): match per id partner OR per nome lowercase trim.
- Bottone "Scrape Blacklist Ora" RIMOSSO (edge function `scrape-wca-blacklist` non esiste); sostituito da card istruzioni how-to.
- Punto d'ingresso unico: Settings → Connessioni → tab Blacklist (NON spostare).

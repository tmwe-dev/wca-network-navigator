# Ridisegno Compose Email — riuso sidebar esistente

Hai ragione: la sidebar esiste già (`ContextFiltersRail` con linguetta a sinistra). Non ne creo una nuova, **aggiungo solo un nuovo "context Compose"** dentro quella già montata.

## Cosa cambia, in pratica

### 1. Sidebar filtri (già esistente) → aggiunta del context "Compose"
File: `src/v2/ui/templates/ContextFiltersRail.tsx`
- Aggiungo un ramo nello switch `getFilterContext`:
  ```ts
  if (pathname.startsWith("/v2/communicate/compose")) {
    return { title: "Filtri Email Compose", content: <EmailComposeFiltersSection />, bannerKey: "email-compose" };
  }
  ```
- Nuova chiave `email-compose` in `sidebarContextRegistry.ts` (icona Mail, descrizione "Tipo, tono, lunghezza, brief, libreria").
- Nuovo file `src/components/global/filters-drawer/EmailComposeFiltersSection.tsx` che contiene **gli stessi controlli che oggi stanno dentro `OraclePanel`**: Tipo email, Tono, Lunghezza, Brief strutturato (BriefAccordion), Libreria immagini on/off.

### 2. Stato condiviso senza riscrivere `useEmailComposerState`
Nuovo store leggero (Context React) `ComposeAiConfigContext` montato da `EmailComposerPage`:
- Espone `{ type, tone, length, brief, library, set… }` con persistenza su `localStorage` (le stesse storage keys già usate da `OraclePanel`, così nessuna logica AI cambia).
- La sezione sidebar legge/scrive lo stesso context.
- L'oracolo destro legge questi valori e li passa invariati a `onGenerate(OracleConfig)` / `onImprove(OracleConfig)` di `useEmailComposerState`.
- **Nessun cambio** a generazione, invio, journalistReview, queue, dedup.

### 3. Oracolo destro snellito
File nuovo `src/components/email/OraclePanelSlim.tsx` (lascio `OraclePanel.tsx` intatto per non rompere altri call site V1/legacy):
- Solo: textarea **Obiettivo**, bottoni **Genera** / **Migliora**, **ContextSummary**, **Insert image / Load template**.
- Tipo / tono / lunghezza / brief / libreria spariscono da qui (vivono in sidebar).

### 4. Recipient Hero Card (centro, in alto)
File nuovo `src/v2/ui/organisms/RecipientHeroCard.tsx` che sostituisce il chip + `RecipientSnapshotHeader`:
- Logo azienda (`partners.logo_url` se presente, altrimenti monogramma colorato).
- Bandiera reale del paese (no emoji "mondo" generica) — usa `getCountryFlag`.
- Riga 1: **NOME AZIENDA** grande + bandiera + paese.
- Riga 2: contatto · email · lead status · n° interazioni · freschezza Deep Search.
- Bottoni: rimuovi destinatario, "Cambia destinatario" (apre picker).
- Bulk (>1): card compatta con conteggio.

### 5. Header pulito
File: `src/v2/ui/templates/GoldenHeaderBar.tsx` (e/o breadcrumb usato sopra `SectionTabs`).
- Quando la sezione ha già `SectionTabs` (Comunica → Inbox/Outreach/Componi/Campagne), nascondo il breadcrumb "Home › Comunica › Compose" che lo duplica.
- I tab "Componi/Inbox/Outreach/Campagne" restano dove sono (in alto, sotto la golden bar) — già coerenti con quanto chiedi.

### 6. Layout finale di `EmailComposerPage`
```text
linguetta filtri (già esistente, sinistra)  |  CENTRO                           |  ORACOLO SLIM (dx)
                                            |                                   |
                                            |  [Recipient Hero Card]            |  Obiettivo
                                            |  Oggetto _______________          |  [textarea ampia]
                                            |  [HTML editor a piena larghezza]  |
                                            |  [Bozza] [Template] [Invia ▶]     |  [Genera] [Migliora]
                                            |                                   |  Context summary
```

## File toccati
**Nuovi**
- `src/components/global/filters-drawer/EmailComposeFiltersSection.tsx`
- `src/components/email/OraclePanelSlim.tsx`
- `src/v2/ui/organisms/RecipientHeroCard.tsx`
- `src/contexts/ComposeAiConfigContext.tsx` (provider + hook)

**Modificati (minimo)**
- `src/v2/ui/templates/ContextFiltersRail.tsx` → un branch in più nello switch.
- `src/components/global/filters-drawer/sidebarContextRegistry.ts` → registra `email-compose`.
- `src/v2/ui/pages/EmailComposerPage.tsx` → wrappa con `ComposeAiConfigProvider`, monta `RecipientHeroCard` e `OraclePanelSlim`.
- `src/v2/ui/templates/GoldenHeaderBar.tsx` (o componente breadcrumb) → nasconde breadcrumb in sezioni con `SectionTabs`.

## Vincoli rispettati
- Nessuna modifica a `useEmailComposerState`, generazione, invio, queue, dedup, `journalistReview`.
- `OraclePanel.tsx` originale resta intatto.
- Sidebar esistente riusata, NON ne nasce una nuova.
- Storage keys delle preferenze Oracolo invariate.
- Tutto il lavoro è UI/presentation.

## QA finale
1. `/v2/communicate/compose` → la linguetta sinistra apre la sidebar con titolo "Filtri Email Compose" e mostra Tipo/Tono/Lunghezza/Brief/Libreria.
2. Cambio "Tipo email" in sidebar → `Genera` nell'oracolo destro produce una mail coerente con quel tipo (verifica payload `OracleConfig` invariato).
3. Hero card: logo + bandiera + nome azienda visibili, X funziona, cambia destinatario apre picker.
4. Breadcrumb non appare più sopra i tab Inbox/Outreach/Componi/Campagne.
5. Bozza, Salva template, Invia: invariati.
6. Altre sezioni (CRM, Network, Email Intelligence): la sidebar resta con i loro filtri, nessuna regressione.



# Piano Fase 1 — Chiusura Gap Critici

## Obiettivo
Portare EmailComposerPage, NetworkPage e SettingsPage a parità con v1, seguendo architettura v2 (< 300 LOC per componente, logica negli hook).

---

## 1. EmailComposerPage (da 171 LOC textarea → editor completo)

**Decomposto in 5 componenti:**

- **EmailComposerPage** (~200 LOC): layout a 3 colonne (recipients sidebar | editor centro | oracle panel destra), gestisce stato globale, coordina invio/bozza/coda
- **RecipientPicker** (~150 LOC): ricerca contatti con autocomplete, chip destinatari multipli, dialog "email sconosciuta" per inserimento manuale nome/azienda
- **EmailEditorPanel** (~200 LOC): integra il `HtmlEmailEditor` v1 esistente (`src/components/email/HtmlEmailEditor.tsx`), toolbar variabili `{{company_name}}`, attachments popover, links popover, preview inline, bottone sorgente HTML
- **OraclePanelV2** (~250 LOC): porta dall'OraclePanel v1 — selezione tipo email, tono, toggle KB/Deep Search, campo obiettivo con dettatura vocale, bottoni Genera/Migliora, tab template, tab galleria immagini
- **EmailBottomBar** (~100 LOC): barra azioni — salva bozza, salva template (se editato dopo AI), invia a N destinatari, CampaignQueueMonitor

**Hook: `useEmailComposerV2`** (~150 LOC): gestisce lo stato del composer (recipients, subject, body, draft, queue), mutazioni per invio/bozza/enqueue, AI generate/improve via edge function

**Funzionalità ripristinate dalla v1:**
- HTML WYSIWYG editor con toggle sorgente
- Variabili `{{company_name}}`, `{{contact_name}}`, `{{city}}`, `{{country}}`
- OraclePanel con tipi email, tono, KB, deep search, obiettivo vocale
- Attachments da bucket templates
- Preview inline con sostituzione variabili
- Salva bozza, salva come template
- Enqueue campagna con monitor
- Prefill da navigation state (partner/contatto/subject/body)

---

## 2. NetworkPage (da 196 LOC lista → hub operativo)

**Decomposto in 4 componenti + 1 hook:**

- **NetworkPage** (~200 LOC): header con switch Partners/BCA, toggle country grid/lista, export Excel, conteggi globali
- **CountryGridV2** (~250 LOC): griglia paesi con celle colorate per densità, click → filtra per paese, usa `get_country_stats` RPC esistente
- **PartnerRow** (estratto, ~80 LOC): riga partner compatta (già presente ma inline)
- **BusinessCardsViewV2** (~200 LOC): vista alternativa BCA con lista business cards, match status, confidence badge

**Hook: `useCountryStatsV2`** (~50 LOC): wrappa RPC `get_country_stats` con cache

**Hook: `useExcelExportV2`** (~80 LOC): export partner filtrati in Excel tramite ExcelJS (lazy loaded)

**Funzionalità aggiunte:**
- Switch Partners/BCA (due viste dati)
- Country Grid con colorazione densità e click-to-filter
- Export Excel dei partner visibili
- Conteggi globali (totale, con email, con telefono, con profilo)

---

## 3. SettingsPage (da 6 tab → 14 tab)

**Approccio:** Usa `VerticalTabNav` come v1 (sidebar verticale), non tabs orizzontali. Ogni tab è un componente < 250 LOC.

**8 tab da creare (i 6 esistenti restano):**

- **VoiceAISettingsTab** (~150 LOC): configurazione ElevenLabs (API key status, voice ID, lingua) — legge da `app_settings` le chiavi `elevenlabs_*`
- **ImportSettingsTab** (~100 LOC): link rapido a pagina import, storico import da `import_logs`
- **RASettingsTab** (~120 LOC): configurazione Report Aziende (credenziali RA network, username/password)
- **EnrichmentSettingsTab** (~150 LOC): dashboard arricchimento semplificata — conteggi per sorgente (WCA, Contatti, Email, BCA)
- **MemoryAISettingsTab** (~120 LOC): dashboard memoria AI — lista memorie episodiche, conteggio KB entries, pulsante reset
- **SubscriptionSettingsTab** (~100 LOC): pannello abbonamento — crediti rimanenti, storico transazioni da `credit_transactions`
- **OperatorsSettingsTab** (~150 LOC): gestione operatori — lista da tabella `operators`, toggle admin
- **TimingSettingsTab** (~120 LOC): configurazione orari agenti (work start/end hour, max actions per cycle) da `app_settings`

**SettingsPage riscritta** (~80 LOC): layout con `VerticalTabNav` laterale (14 voci), rendering condizionale del tab attivo

---

## Dettagli tecnici

### File da creare (19 nuovi):
```text
src/v2/ui/organisms/email/RecipientPicker.tsx
src/v2/ui/organisms/email/EmailEditorPanel.tsx
src/v2/ui/organisms/email/OraclePanelV2.tsx
src/v2/ui/organisms/email/EmailBottomBar.tsx
src/v2/hooks/useEmailComposerV2.ts
src/v2/ui/organisms/network/CountryGridV2.tsx
src/v2/ui/organisms/network/BusinessCardsViewV2.tsx
src/v2/hooks/useCountryStatsV2.ts
src/v2/hooks/useExcelExportV2.ts
src/v2/ui/organisms/settings/VoiceAISettingsTab.tsx
src/v2/ui/organisms/settings/ImportSettingsTab.tsx
src/v2/ui/organisms/settings/RASettingsTab.tsx
src/v2/ui/organisms/settings/EnrichmentSettingsTab.tsx
src/v2/ui/organisms/settings/MemoryAISettingsTab.tsx
src/v2/ui/organisms/settings/SubscriptionSettingsTab.tsx
src/v2/ui/organisms/settings/OperatorsSettingsTab.tsx
src/v2/ui/organisms/settings/TimingSettingsTab.tsx
```

### File da riscrivere (3):
```text
src/v2/ui/pages/EmailComposerPage.tsx
src/v2/ui/pages/NetworkPage.tsx
src/v2/ui/pages/SettingsPage.tsx
```

### Dipendenze v1 riutilizzate (non copiate, importate):
- `src/components/email/HtmlEmailEditor.tsx` — editor HTML WYSIWYG
- `src/data/defaultEmailTypes.ts` — tipi email predefiniti
- `src/lib/countries.ts` — `getCountryFlag`
- `src/data/wcaCountries.ts` — lista paesi WCA

### Regole rispettate:
- Ogni componente < 300 LOC
- Logica in hook, UI logic-less
- Zero `any`, naming di dominio
- Import da `@/v2/` per moduli v2, da `@/` per utility condivise


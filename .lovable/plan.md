## Cosa sta succedendo (diagnosi)

### Problema 1 — "Le card non si aggiornano dopo il Deep Search"
Il motore Sherlock (`src/v2/services/sherlock/sherlockEngine.ts`) consolida correttamente i risultati (emails, phones, address, descrizione, social, ecc.) nel campo `consolidated`, ma **scrive sul partner solo due campi**:
- `updatePartnerWebsiteIfMissing` (riga 292)
- `updatePartnerLinkedinIfMissing` (righe 310, 467)

Tutti gli altri dati estratti restano nell'`investigation_results` ma **non finiscono mai in `partners.enrichment_data` né in `partners.contact_info`**, quindi le card del Network non hanno nulla di nuovo da mostrare.

In più, `useSherlock` invalida le query (`invalidateEnrichmentCaches`) solo nel ramo `stop()` — non al termine naturale di una run riuscita. Risultato: anche le poche scritture (website/linkedin) non si vedono finché non ricarichi la pagina.

### Problema 2 — Lo scraper si ferma sui popup cookie/privacy
L'estensione FireScrape (`public/partner-connect-extension/content.js`) tratta i banner cookie come *rumore da rimuovere dal DOM dopo averli letti* (`NOISE_SELECTORS` include `.cookie`, `.popup`, `.modal`, `.overlay`). Ma su molti siti reali:
- l'overlay blocca lo scroll e nasconde il contenuto via `position:fixed` + `overflow:hidden` sul `body`
- alcuni framework (OneTrust, Cookiebot, Didomi, Quantcast, IAB TCF) **non renderizzano** il contenuto principale finché non hai consentito
- in SSR/Cloudflare, prima di `Accept` ti viene servita solo la pagina di consent

Quindi togliere il banner dal markdown non basta: bisogna **cliccare "Accetta"** dentro al tab prima di estrarre.

---

## Piano di intervento

### Step 0 — Backup estensione (PRIMA di qualsiasi modifica)
Copia integrale di `public/partner-connect-extension/` in `archive/partner-connect-extension-v3.4.3-2026-05-15/` come snapshot read-only. Nessuna modifica al sorgente live finché il backup non è in place.

### Step 1 — Auto-accept dei consent popup nell'estensione
In `public/partner-connect-extension/background.js`, nuova funzione `autoAcceptConsent(tabId)` chiamata **dentro `withTab`, dopo `waitForTabLoad` e prima di `scrapeTab`** (quindi attiva su `protectedScrape`, `handleGoogleSearch` e gli step del crawl).

Strategia a cascata, eseguita via `chrome.scripting.executeScript`:
1. **Selettori noti dei principali CMP** (id/class deterministici): OneTrust (`#onetrust-accept-btn-handler`), Cookiebot (`#CybotCookiebotDialogBodyLevelButtonAccept`, `…ButtonAcceptAll`), Didomi (`#didomi-notice-agree-button`), Quantcast (`.qc-cmp2-summary-buttons button[mode="primary"]`), TrustArc, Iubenda (`.iubenda-cs-accept-btn`), Cookieyes, Usercentrics, Termly, Complianz, Borlabs, GDPR-cookie-consent generici (`button[aria-label*="accept" i]`).
2. **Fallback testuale**: scansione di `button`, `a[role="button"]`, `[role="button"]` con `textContent` che combacia (case-insensitive, multilingua) con: accept all / accetta tutti / accetto / consenti / sono d'accordo / agree / ok / got it / I accept / autoriser / akzeptieren / aceptar / aceitar.
3. **Reset scroll lock**: dopo il click, `document.body.style.overflow=''`, `document.documentElement.style.overflow=''`, rimozione di `[class*="no-scroll"]`, `.modal-open` sul body.
4. **Settle window**: 600–900ms di attesa post-click + `MutationObserver` cap 1.5s per lasciare al sito il tempo di renderizzare il contenuto reale.

Tutto idempotente: se nessun banner trovato, esce subito senza errori. Logging via `relayLog({ kind: 'consent', accepted, selector })` per auditare l'efficacia.

`content.js` resta invariato per ora (rimozione cosmetica del banner residuo dal markdown va bene).

### Step 2 — Persistenza completa dei findings sul partner
In `src/v2/services/sherlock/sherlockEngine.ts`, sostituire i due update parziali con un'unica chiamata finale `persistConsolidatedToPartner(partnerId, consolidated)` (nuovo helper in `src/data/partners.ts`).

Mapping deterministico (solo se il campo partner è vuoto/null — niente sovrascritture aggressive):
- `consolidated.website_discovered` → `partners.website`
- `consolidated.linkedin_company_url_discovered` → `partners.linkedin_url`
- `consolidated.emails[]` → merge in `partners.contact_info.emails` (dedup case-insensitive)
- `consolidated.phones[]` → merge in `partners.contact_info.phones` (dedup E.164 via `phone-normalization`)
- `consolidated.address`, `city`, `postal_code`, `country` → `partners.contact_info` se mancanti
- `consolidated.description`, `consolidated.services`, `consolidated.industry`, `consolidated.social_*`, `consolidated.year_founded`, ecc. → merge in `partners.enrichment_data` (JSON, sempre additivo + timestamp `_sherlock_last_run`)

Tutto in un'unica `update` su `partners` (rispetta DAL: passa da `updatePartner` esistente). Soft-delete e RLS già coperti.

### Step 3 — Refresh UI a fine run
In `src/v2/hooks/useSherlock.ts`, dopo `runAgenticSherlock` riuscito (non solo nel ramo `stop`):
- chiamare `invalidateEnrichmentCaches(queryClient, partnerId)`
- invalidare anche `queryKeys.partners.detail(partnerId)` e `queryKeys.partners.list` (centralizzati in `src/lib/queryKeys.ts`) così il `CompanyCard` nel Network e il `PartnerDetailInline` si rifrescano live
- toast informativo: "Card aggiornata: N nuovi campi" basato sul diff

### Step 4 — Verifica
- Lanciare Detective su un partner con sito noto che ha banner OneTrust/Cookiebot (es. un partner EU). Controllare via `relayLog` che il consent sia stato cliccato e che il markdown contenga il contenuto reale, non più il testo del banner.
- Aprire il `CompanyCard` post-run e confermare che email/telefoni/descrizione siano comparsi senza F5.
- Test esistenti: `e2e/deep-search-runner.spec.ts` deve restare verde.

---

## Sezione tecnica (per riferimento codice)

**File toccati:**
- `archive/partner-connect-extension-v3.4.3-2026-05-15/**` (nuovo, copia integrale)
- `public/partner-connect-extension/background.js` (+ nuova `autoAcceptConsent`, integrazione in `withTab`/`protectedScrape`, bump versione manifest a `3.4.4`)
- `public/partner-connect-extension/manifest.json` (version → `3.4.4`, descrizione aggiornata)
- `src/data/partners.ts` (+ `persistSherlockFindings(partnerId, consolidated)`)
- `src/v2/services/sherlock/sherlockEngine.ts` (rimuove i due update locali, chiama l'helper finale prima di `buildFinalSummary`)
- `src/v2/hooks/useSherlock.ts` (invalidazione query a fine run + toast diff)

**Memoria da aggiornare a fine sprint:**
- `mem://architecture/sherlock-as-unified-deep-search` → nota persistenza completa su `partners`
- nuova memoria `mem://tech/communication/firescrape-consent-auto-accept` → strategia CMP + fallback testuale
- nessuna modifica a `check-inbox` / IMAP / WCA bridge (intoccabili).

**Vincoli rispettati:** soft-delete (no DELETE), DAL only (`src/data/`), no `supabase.from()` in UI, query keys da `lib/queryKeys.ts`, niente refactor opportunistici sui nodi critici (Sherlock engine modificato in modo additivo locale).
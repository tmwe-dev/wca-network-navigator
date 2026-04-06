

# Ricostruire AddContactDialog: Ricerca come primo tab + collegare i sistemi esistenti

## Problemi attuali

1. **Tab "Ricerca" è il terzo** — deve essere il primo, l'utente parte da lì
2. **Logo search** non usa il sistema reale (`useDeepSearchLocal.scrapeWebsite` che genera favicon da Google), fa solo una google search inutile
3. **Deep Search** non usa `useDeepSearch()` (il context provider già attivo in AppLayout), chiama direttamente `fsBridge.scrapeUrl` + `enrich-partner-website` senza salvare nulla nel record
4. **LinkedIn search** usa `fsBridge.googleSearch` direttamente — non usa `useDeepSearchLocal.searchLinkedInForContacts` che ha la logica cascade completa con AI validation
5. **Google Places** usa `fsBridge.googleSearch` che richiede Partner Connect per navigare Google — funziona solo se l'estensione è installata. Non c'è alternativa
6. **I campi nome azienda e nome contatto** sono nel tab Ricerca separati da quelli dei tab Azienda/Contatto — l'utente deve inserirli due volte
7. **Il salvataggio** crea un `imported_contact` ma le ricerche (logo, deep search) non aggiornano quel record

## Piano di intervento

### Ristrutturare i tab

Ordine nuovo: **Ricerca → Azienda → Contatto → Note**

Il tab **Ricerca** diventa il punto di partenza con:
- Campo "Nome Azienda" in alto (collegato allo state `companyName` condiviso)
- Campo "Nome Contatto" sotto (collegato a `contactName` condiviso)
- Sotto: i 4 strumenti di ricerca (Google, LinkedIn, Logo, Deep Search)
- I risultati della ricerca Google auto-compilano i campi degli altri tab

### Collegare i sistemi reali

| Funzione | Attuale (rotto) | Nuovo (collegato) |
|----------|----------------|-------------------|
| **Logo** | `fsBridge.googleSearch("logo")` → non salva nulla | Usa favicon Google `google.com/s2/favicons?domain=...&sz=128` dal website trovato, come fa `useDeepSearchLocal.scrapeWebsite` |
| **LinkedIn** | `fsBridge.googleSearch("site:linkedin.com")` → salva solo in note | Usa `fsBridge.googleSearch` con cascade queries + AI validation via `aiCall` (stesso pattern di `useDeepSearchLocal.searchLinkedInForContacts`) → salva URL LinkedIn nel campo del record |
| **Deep Search** | `fsBridge.scrapeUrl` → `enrich-partner-website` → risultato perso | Dopo il salvataggio del contatto, chiama `useDeepSearch().start([id])` con mode "contact" per eseguire il deep search completo del sistema |
| **Google Search** | `fsBridge.googleSearch` — OK ma risultati mal parsati | Mantiene `fsBridge.googleSearch`, migliora il parsing: estrae indirizzo, telefono, email, website dai risultati e auto-compila i campi |

### Flusso utente

1. Apre dialog → tab Ricerca attivo
2. Scrive nome azienda → clicca "Cerca su Google"
3. Risultati appaiono → clicca su uno → auto-compila website, indirizzo, città, paese
4. Logo: se c'è un website, genera automaticamente favicon URL
5. LinkedIn: cerca con nome contatto + nome azienda
6. Deep Search: dopo "Salva", opzionalmente avvia deep search completo sul record creato
7. Può andare nei tab Azienda/Contatto per completare i dati mancanti

### Dettagli implementativi

**File**: `src/components/contacts/AddContactDialog.tsx` — riscrittura sostanziale

- Importare `useDeepSearch` da `useDeepSearchRunner`
- Tab order: `search` → `company` → `contact` → `notes`, defaultValue `"search"`
- Nel tab Ricerca: due Input sempre visibili (companyName, contactName) + 4 sezioni strumenti
- **handlePlacesSearch**: resta con `fsBridge.googleSearch`, ma `applyPlacesResult` estrae meglio i dati (website dal URL, parsing indirizzo)
- **handleLogoSearch**: se `website` è popolato, calcola `https://www.google.com/s2/favicons?domain=${domain}&sz=128` e mostra preview
- **handleLinkedInSearch**: cascade queries come in `useDeepSearchLocal`, salva URL in uno state `linkedinUrl` mostrato nel form
- **handleDeepSearch**: post-salvataggio, chiama `deepSearch.start([savedId], true, "contact")` per i contatti importati
- **handleSave**: salva con `linkedin_url` e `logo_url` nel record `imported_contacts` (se i campi esistono nella tabella), altrimenti nelle note

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/contacts/AddContactDialog.tsx` | Ristrutturazione completa: tab order, collegamento sistemi reali |

Nessun nuovo file, nessuna migrazione DB necessaria (i campi linkedin e logo vanno nelle note o in campi esistenti della tabella `imported_contacts`).


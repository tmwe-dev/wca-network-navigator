# Audit Menu Principale V2 — 2026-07-17

> Metodo: caricamento headless (Chromium) di ogni voce del menu con sessione
> TMWE reale iniettata, cattura screenshot + console + network + conteggio
> UI. Fonte SSOT del menu: `src/v2/ui/templates/navConfig.tsx` — `FULL_NAV_ITEMS`.
>
> Legenda semaforo:
> - 🟢 Verde: pagina carica, header/rail coerenti, funzioni presenti.
> - 🟡 Giallo: carica ma con difetti UX o dati mancanti visibili.
> - 🔴 Rosso: bug funzionale o errore runtime bloccante.

---

## Difetti trasversali (tutte le pagine)

Ricorrono su 15+ pagine, vanno risolti UNA volta sola.

1. **`POST /rest/v1/rpc/cron_job_status` → 400** su ogni caricamento (chiamato
   da StatusPill/header). L'RPC non esiste o firma cambiata. Debito: rimuovere
   la chiamata o correggere l'RPC.
2. **CSP `frame-ancestors` via `<meta>` ignorato** (avviso console). La
   direttiva deve essere via header HTTP, non `<meta>`. Cosmetico ma inquina
   ogni log.
3. **Blacklist banner "63 giorni"** occupa spazio in cima a ogni pagina anche
   quando la pagina non c'entra con WCA. Da confinare al modulo Acquisition.
4. **Sidebar sinistra**: alcune voci del menu (screenshot utente) hanno
   etichette che non coincidono con l'`h1` della pagina di destinazione
   (es. "Autorizza" → nessun `h1`; "Agenti" → `h1: Funnemail`).

---

## COMANDO

### 🟢 Command — `/v2/command`
- Header pulito, orbe centrale + input "Scrivi un obiettivo…".
- 19 bottoni, 1 input. Nessun error boundary.
- Empty-state elegante ("Cosa vuoi ottenere?"). OK.
- Debito: fix cron_job_status 400.

### 🟡 Missioni — `/v2/agents/autopilot`
- `h1: Agent Missions` (inglese) mentre voce menu è "Missioni" (italiano).
- Empty state ok ("Nessuna missione. Crea la prima missione autopilot.").
- CTA "+ Nuova Missione" presente in alto a destra.
- **UX**: titolo e sottotitolo da tradurre. Header custom, non `StandardPageFrame`.

---

## ESPLORA

### 🟡 Vendi — `/v2/explore/network`
- Carica lista partner (WCA), rail filtri sx visibile ("FILTRI WCA PARTNER").
- **219 bottoni visibili**: densità estrema, la tabella genera un bottone per
  cella/azione. Verificare virtualizzazione o riduzione bottoni per riga.
- Voce menu "Vendi" ↔ pagina "Network/Partner": nomenclatura non allineata.

---

## PIPELINE

### 🔴 Autorizza — `/v2/cestinone`
- **Nessun `h1` visibile**: la pagina non ha titolo, l'utente non sa dove si trova.
- Console: `400` su una risorsa (probabilmente RPC cronjob).
- 13 bottoni, 1 input. Non è chiaro cosa "autorizzare".
- **Fix**: aggiungere header con titolo "Cestinone / Autorizza" + descrizione.

### 🟡 Cockpit — `/v2/cockpit`
- Due `h2`: "CONFIGURAZIONE EMAIL AI" e "Cockpit". Doppio titolo, header
  non uniformato.
- 61 bottoni, 4 input. Densità alta ma funzionale.
- OK come funzioni, da uniformare a `StandardPageFrame`.

### 🟢 Agenda — `/v2/agenda`
- Rail filtri sx ("FILTRI AGENDA"), lista giornata a destra ("Venerdì 17 Luglio
  2026"), sezione "DA RISPONDERE" visibile. Coerente.
- 74 bottoni, 1 input.

---

## COMUNICA

### 🟡 Comms — `/v2/comms`
- `h2: Comunicazioni` + preview conversazione. OK.
- Console: **2× 404** su risorse (probabilmente asset icona o edge legacy).
  Da tracciare.

### 🔴 Leggi — `/v2/inbox`
- Rail "FILTRI FUNNEMAIL" — la voce menu è "Leggi" ma la pagina espone
  filtri "Funnemail": incoerenza semantica (l'utente non capisce se sta in
  inbox o in Funnemail).
- **CORS blocca `POST functions/v1/manage-email-folders`**: la edge function
  non risponde al preflight `OPTIONS`. Bug funzionale: probabile impossibilità
  di caricare le cartelle IMAP dall'UI. **Da fixare**.

### 🔴 Scrivi — `/v2/email`
- **Nessun `h1`/`h2`**: pagina senza titolo.
- Empty state 1 hit ma layout vuoto (28 bottoni, 3 input, 0 heading).
- Da capire se è EmailComposerPage o EmailForge: la rotta `/v2/email` merita
  landing page dedicata con scelta "Composer / Forge / Strategies".

### 🔴 Funnemail — `/v2/email-intelligence`
- Rail filtri + 5 tab visibili + lista cartelle con contatori (ADS 162,
  AIrline_News 35…). Struttura densa ma leggibile.
- **Stesso CORS su `manage-email-folders`** (blocca il refresh cartelle).
- 148 bottoni: da valutare compressione (menu contestuale invece che bottoni).

### 🟡 Funnemail Inbox — `/v2/funnemail-inbox`
- Solo rail "FILTRI FUNNEMAIL", **0 headings visibili** e 15 bottoni.
- Sembra una pagina "guscio" senza contenuto principale evidente. Verificare
  se serve fondere con `/v2/email-intelligence` (voce menu duplicata).
- **Sovrapposizione forte con "Leggi" e "Funnemail"** — 3 voci menu per la
  stessa area concettuale.

### 🟢 Rubrica WhatsApp — `/v2/rubrica/whatsapp`
- `h1: Rubrica WhatsApp`, 10 bottoni, 1 input di ricerca. Pulito.

### 🟢 Rubrica LinkedIn — `/v2/rubrica/linkedin`
- `h1: Rubrica LinkedIn`, layout speculare a WhatsApp. Empty state coerente.

---

## CERVELLO

### 🔴 Agenti — `/v2/intelligence/agents`
- **`h1: Funnemail`** invece di "Agenti": la rotta `/v2/intelligence/agents`
  atterra sulla stessa pagina di `/v2/intelligence` (default tab Funnemail).
  L'utente clicca "Agenti" ma vede "Funnemail". **Bug di routing/tab default**.

### 🟡 Intelligence — `/v2/intelligence`
- Stessa pagina di sopra (`h1: Funnemail`, 30 bottoni). Le due voci di menu
  puntano al medesimo componente. **Consolidare o rendere tab distinta**.

---

## LAB

### 🟢 Lab — `/v2/lab`
- 15 tab pill, header "Scenari AI — banco di prova edge function", tab "Assistente
  AI · 1" con badge. Struttura Config-Driven come da memoria.
- 38 bottoni, 7 input. OK.

---

## CONFIG

### 🟢 Config — `/v2/settings`
- 4 tab visibili, contenuti "Numero WhatsApp", "Language", "Intensità testo".
- 37 bottoni, coerente.

---

## Backlog fix prioritizzato

### P0 — Bug funzionali
1. **CORS `manage-email-folders`** (Leggi + Funnemail): edge function
   deve rispondere al preflight `OPTIONS` con `Access-Control-Allow-Origin`.
2. **`/v2/intelligence/agents` mostra Funnemail**: fix default tab / routing.
3. **`/v2/cestinone` senza titolo**: aggiungere header pagina.
4. **`/v2/email` senza titolo/landing**: creare landing o rimappare la voce.

### P1 — Coerenza semantica menu
5. Voci menu vs `h1`: "Missioni"↔"Agent Missions", "Vendi"↔"WCA Partner",
   "Leggi"↔filtri "Funnemail", "Agenti"↔"Funnemail". Allineare label o titoli.
6. Sovrapposizione **Leggi / Funnemail / Funnemail Inbox** — 3 voci, 1
   dominio. Ridurre a 1-2 voci.
7. Sovrapposizione **Agenti / Intelligence** — stessa pagina, 2 voci.

### P2 — Debito trasversale
8. Rimuovere/fixare `rpc/cron_job_status` (400 su ogni pagina).
9. Confinare banner "Blacklist non aggiornata" al modulo Acquisition.
10. `StandardPageFrame` non adottato uniformemente (Missioni, Cockpit, Autorizza,
    Scrivi hanno header custom o assenti).
11. Migrare CSP `frame-ancestors` da `<meta>` a header HTTP.

### P3 — UX densità
12. `/v2/explore/network`: 219 bottoni visibili — comprimere azioni per riga.
13. `/v2/email-intelligence`: 148 bottoni — usare menu contestuali.

---

## Prossimi passi

1. Fix P0 (bug funzionali) in ordine 1→4, ognuno con verifica Playwright.
2. Consolidamento menu (P1 punti 6–7) con proposta di riduzione da 17 a ~12 voci.
3. Adozione `StandardPageFrame` sulle pagine mancanti (P2 punto 10).

Screenshot completi salvati in `/tmp/browser/audit/*.png`; JSON grezzo in
`/tmp/browser/audit/all.json`.
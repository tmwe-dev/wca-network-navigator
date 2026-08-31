# V2: barra superiore + piano di ristrutturazione

V3 resta dov'è, congelata e inerte (nessun file V2 la importa). Si va avanti su V2.

## Parte 1 — La barra in alto (Command e tutte le pagine)

Oggi la riga contiene, da sinistra: ☰ menu, StatusPill (pallino stato), AutomationsPanel (ingranaggio), header contestuale Esplora, slot titolo pagina; a destra: campanella notifiche, download estensioni, sync WhatsApp, selettore casella/operatore, menu ⋯ (che contiene Nuovo contatto, Agent Operations, Enrichment, Trace Console, Test estensioni, tema, logout).

Problema: 9 controlli affiancati senza gerarchia, tre di essi (download estensioni, sync WhatsApp, test estensioni) sono azioni rare messe allo stesso livello di azioni quotidiane; il refresh e il pallino non dicono cosa fanno.

### Struttura proposta — tre zone fisse, sempre uguali

```text
[☰]  Titolo pagina › breadcrumb        |   [azioni della pagina]   |  [🔔] [casella ▾] [⋯]
 identità            contesto                    lavoro                   sistema
```

- **Zona identità (sinistra, fissa)**: solo ☰ + titolo/breadcrumb della pagina corrente. Niente altro.
- **Zona contesto (centro)**: slot unico dove ogni pagina inserisce i propri controlli (filtri Esplora, controlli campagna, ecc.). Oggi sono due slot separati + un header Esplora: si uniscono in uno solo.
- **Zona sistema (destra, fissa)**: 3 elementi soltanto.
  1. **🔔 Notifiche** (invariata).
  2. **Casella attiva** — diventa il centro di stato: mostra `luca@tmwe.it`, e nel menu a tendina raccoglie casella/operatore + stato sincronizzazione email + ultimo aggiornamento + tasto «Sincronizza ora» (l'attuale refresh, finalmente etichettato) + sync WhatsApp. Un solo posto per «i miei canali».
  3. **⋯ Sistema** — menu unico con: Nuovo contatto, Agenti e monitor, Enrichment, Estensioni (download + test), Trace Console, Tema, Logout. Raggruppato con separatori e titoletti.

Sparisce dalla barra: pallino StatusPill isolato (assorbito nel menu casella), pulsante estensioni, pulsante WhatsApp, ingranaggio automazioni (va nel menu Sistema).
Risultato: da 9 controlli a 3 fissi + N contestuali.

### Regole grafiche del template (da applicare ovunque)

- Altezza fissa 44px, bordo inferiore 1px, sfondo vetro come oggi.
- Tutti i pulsanti icona 32×32, stessa area cliccabile, tooltip obbligatorio con nome + eventuale scorciatoia.
- Nessuna icona senza etichetta nel menu; ogni voce ha icona + testo.
- Badge di stato: pallino colorato solo dentro il menu casella, mai icone lampeggianti in barra.
- Mobile: la zona sistema collassa in un unico ⋯; la zona contesto diventa una seconda riga scrollabile.

### Come si realizza

1. `src/v2/ui/templates/header/` — nuovo `MailboxStatusMenu.tsx` che assorbe `StatusPill`, `WhatsAppSyncButton`, il refresh sync e `OperationalContextSelector`.
2. `HeaderToolsMenu.tsx` — accoglie `DownloadExtensionsButton` e `AutomationsPanel` come voci.
3. `LayoutHeader.tsx` — riscritto sulle tre zone; slot titolo e slot contestuale unificati in `#page-context-slot` mantenendo l'id vecchio come alias per non rompere le pagine che ci scrivono via portal.
4. Nessuna modifica alla logica di sync, notifiche, auth: si sposta solo la presentazione.

## Parte 2 — Piano di ristrutturazione V2 (dall'audit)

Numeri reali di oggi: 2.404 file TS in `src`, di cui 731 in `src/v2`; 151 edge function; ~400 migrazioni.

Cinque cantieri, in ordine di ritorno:

1. **Barra + guscio uniforme** (Parte 1). Ricade su tutte le pagine, costo basso.
2. **Menu a 7 macro-aree già esistente, ma pagine doppie**: esistono coppie v1/v2 della stessa maschera. Si sceglie la versione viva, si reindirizza l'altra, si archivia. Obiettivo: −20 pagine dal menu senza perdere funzioni.
3. **Edge function 151 → ~100**: consolidare i cluster già mappati (5 classificatori email → 1, 4 scheduler → 1, tool CRM duplicati, funzioni di test one-off). Nessun cambio di comportamento, solo unificazione.
4. **Standard maschera unico**: tutte le liste con la stessa tabella, stessi filtri con X, stessa intestazione entità (logo + bandiera + città), stessi tasti visibili con bordo. Applicazione progressiva pagina per pagina, partendo dalle 6 più usate.
5. **Baseline migrazioni + repo privato**: richiede una tua conferma esplicita (backup DB) prima di toccare qualsiasi cosa.

## Cosa faccio subito, se approvi

Solo la Parte 1: template barra superiore, senza toccare logica. Poi la applichiamo a Command e la vedi dal vivo prima di estenderla.

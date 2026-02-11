

# Nuova Pagina "Acquisizione Partner" -- Download + Enrichment Unificati

## Panoramica

Creare una nuova pagina che sostituisce l'attuale Download Management, unificando il processo di download, analisi AI, arricchimento sito web e deep search in un'unica esperienza visiva interattiva, simile a un videogame.

## Pipeline Attuale (come funziona oggi)

Il processo attuale e' frammentato in 4 passaggi separati, ognuno con un bottone diverso:

```text
1. DOWNLOAD (scrape-wca-partners)
   Scarica il profilo WCA, salva partner + contatti + network + cert.
   --> Lancia in automatico:
       - analyze-partner (AI: rating, servizi, tipo, riassunto IT)
       - parse-profile-ai (AI: estrae contatti mancanti dal raw HTML)

2. ENRICH WEBSITE (enrich-partner-website) -- bottone separato
   Firecrawl + Gemini: estrae fatturato, dipendenti, magazzini, flotta,
   key_markets, summary_it dal sito web

3. DEEP SEARCH (deep-search-partner) -- bottone separato
   Firecrawl: cerca LinkedIn personali dei contatti + logo aziendale

4. RESYNC CONTATTI -- sezione separata
   Ri-scarica il profilo per aggiornare email/telefoni mancanti
```

## Nuova Architettura: Pipeline Unificata

Tutti e 4 i passaggi vengono eseguiti in sequenza automatica per ogni partner, con visualizzazione live del "documento" che si costruisce davanti agli occhi dell'utente.

```text
Per ogni partner:
  1. scrape-wca-partners (download profilo + AI classify)
  2. parse-profile-ai (estrazione contatti AI)  [gia' fire-and-forget]
  3. enrich-partner-website (dati aziendali)    [se ha website]
  4. deep-search-partner (LinkedIn + logo)      [opzionale]
```

## Layout della Nuova Pagina

```text
+------------------------------------------------------------------+
| [Seleziona Paese v] [Seleziona Network v]  [Sessione WCA: ●]     |
|  IT  DE  AE  (chip paesi selezionati)                             |
+------------------------------------------------------------------+
| Trovati: 42 nella directory | Gia' scaricati: 18 | Nuovi: 24     |
| [===== Avvia Acquisizione =====]                                  |
+-----------------------------+------------------------------------+
|                             |                                    |
|  LISTA PARTNER (sx, 40%)    |  CANVAS DOCUMENTO (dx, 60%)        |
|                             |                                    |
|  [card partner 1] ✓ fatto   |  +----- Partner in corso -------+ |
|  [card partner 2] ✓ fatto   |  | Logo    AZIENDA SRL          | |
|  [card partner 3] ● attivo  |  | Baku, Azerbaijan  🇦🇿         | |
|  [card partner 4] ○ attesa  |  |                               | |
|  [card partner 5] ○ attesa  |  | Contatti:                     | |
|  ...                        |  |  Mr. Ali - CEO                | |
|  ...                        |  |  📧 ali@company.com           | |
|  ...                        |  |  📱 +994 50 123 4567          | |
|                             |  |                               | |
|                             |  | Servizi: ✈ 🚢 🚛              | |
|                             |  | Mercati: 🇦🇪 🇸🇦 🇨🇳           | |
|                             |  | Magazzini: 54.000 mq          | |
|                             |  | Dipendenti: 1.200             | |
|                             |  | Rating: ★★★★☆ (3.5)          | |
|                             |  +-------------------------------+ |
|                             |                                    |
+-----------------------------+------------------------------------+
| [Cestino Acquisiti: 18 partner]  ← animazione cometa qui         |
+------------------------------------------------------------------+
```

## Dettaglio Tecnico

### File da Creare

| File | Descrizione |
|------|-------------|
| `src/pages/AcquisizionePartner.tsx` | Pagina principale con layout, selezione paese/network, stato pipeline |
| `src/components/acquisition/PartnerCanvas.tsx` | Canvas documento a destra con animazioni fade-in sequenziali |
| `src/components/acquisition/PartnerQueue.tsx` | Lista partner a sinistra con stati (attesa/attivo/completato) |
| `src/components/acquisition/AcquisitionBin.tsx` | "Cestino" in basso con contatore e animazione cometa |
| `src/components/acquisition/AcquisitionToolbar.tsx` | Barra superiore: selezione paese, network, sessione WCA |

### File da Modificare

| File | Modifiche |
|------|-----------|
| `src/App.tsx` | Aggiungere route `/acquisizione` |
| `src/components/layout/AppSidebar.tsx` | Aggiungere link "Acquisizione" nella sidebar |

### Flusso di Esecuzione

1. L'utente seleziona uno o piu' paesi e un network (o tutti)
2. Il sistema scansiona la directory (come oggi) e mostra il conteggio
3. L'utente clicca "Avvia Acquisizione"
4. Per ogni partner:
   - La card nella lista sinistra si illumina (stato "attivo")
   - Sul canvas destro appare il documento che si costruisce sezione per sezione:
     - **Fase 1** (scrape-wca-partners): Nome, citta', contatti, descrizione
     - **Fase 2** (parse-profile-ai): Contatti addizionali estratti dall'AI
     - **Fase 3** (enrich-partner-website): Dati aziendali (dipendenti, magazzini, mercati, routing)
     - **Fase 4** (deep-search-partner): Logo e LinkedIn (opzionale)
   - Ogni fase appare con un'animazione di fade-in
   - Al completamento, il documento "vola" verso il cestino in basso con un'animazione a cometa
   - Il contatore del cestino si incrementa
   - Si passa al partner successivo

### Canvas: Struttura del Documento

Il documento mostra tutti i dati del partner in un layout formattato:

- **Header**: Logo (se trovato) + Nome azienda + Bandiera paese + Citta'
- **Contatti**: Lista contatti con icone email/telefono/mobile (sky-500)
- **Servizi**: Icone servizi trasporto (sky-500) e specialita' (slate-500)
- **Mercati Principali**: Bandiere dei paesi serviti (da enrichment_data.key_markets)
- **Routing**: Coppie bandiere per le rotte principali
- **Dati Aziendali**: Magazzini (mq), Dipendenti, Anno fondazione, Flotta
- **Rating**: Stelle con breakdown
- **Network WCA**: Loghi dei network di appartenenza
- **LinkedIn**: Link ai profili personali trovati

### Animazione "Cometa"

Quando un partner e' completato:
1. Il canvas si riduce con scale-out
2. Una "particella" luminosa (gradient sky->amber) si stacca dal canvas
3. Percorre una traiettoria curva verso il cestino in basso
4. Il cestino pulsa brevemente e incrementa il contatore
5. Il canvas si resetta con fade-in per il prossimo partner

Implementazione: CSS animation con `@keyframes` per il percorso bezier + `transform` e `opacity`.

### Gestione Sessione WCA

- Prima di avviare, verifica automatica della sessione (come oggi)
- Se scaduta, mostra dialog bloccante con istruzioni
- Indicatore semaforo visibile nella toolbar

### Velocita' e Controllo

- Slider velocita' (come oggi, 0-60s tra un partner e l'altro)
- Pulsante Pausa/Riprendi
- Pulsante Stop (interrompe il processo)
- Checkbox "Includi Deep Search" (piu' lento ma completo)
- Checkbox "Includi Arricchimento Sito" (default on)

### Cosa Succede alla Pagina Attuale

La pagina Download Management attuale (`/download-management`) viene mantenuta ma la sidebar punta alla nuova pagina `/acquisizione` come esperienza principale. L'utente puo' ancora accedere alla vecchia pagina se necessario.

## Stile Visivo

- Glassmorphism coerente con il resto dell'app
- Palette: sky-500 (primario), slate-500 (secondario), amber-400 (accenti)
- Canvas con bordo gradient animato durante l'elaborazione
- Card partner nella lista con micro-animazioni di stato
- Sfondo con gradient radiale sottile
- Supporto tema chiaro/scuro (come Download Management attuale)


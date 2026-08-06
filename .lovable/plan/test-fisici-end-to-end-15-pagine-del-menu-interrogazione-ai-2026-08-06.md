# Test fisici end-to-end: 15 pagine del menu + interrogazione AI

Obiettivo: guidare io stesso il browser (Playwright headless sul dev server locale), pagina per pagina, comportandomi come un operatore commerciale reale, e produrre un elenco puntuale di difetti da correggere. Nessuna correzione in questa fase: solo test, evidenze e lista.

## Fase 0 — Setup sessione
- Ripristino la sessione autenticata nel browser (se non disponibile, lo dichiaro e testo solo le rotte pubbliche invece di inventare risultati).
- Attivo i watcher: errori JS, errori di rete 4xx/5xx, ErrorBoundary, schermate bianche.
- Screenshot desktop (1280) per ogni pagina; passata mobile (375) sulle pagine principali.

## Fase 1 — Giro completo delle 15 voci del menu
Per ogni pagina: apertura, attesa caricamento dati, verifica che i contenuti reali compaiano (non solo skeleton), apertura di un elemento di dettaglio o drawer, uso di un filtro, screenshot.

Comando: Command, Missioni
Esplora: Rete partner
Pipeline: Cestinone, Cockpit, Agenda
Comunica: Comms, Inbox, Scrivi email, Email Intelligence, Rubrica WhatsApp, Rubrica LinkedIn
Cervello: Agenti
Lab: Lab
Config: Impostazioni

## Fase 2 — Interrogazione AI come operatore commerciale
Sulla pagina Command eseguo una batteria di richieste reali, una per volta, aspettando la risposta completa e registrando esito, tempo e qualità:

1. Ricerca dati: "quanti partner abbiamo negli Stati Uniti", "chi lavora con Djibouti", "partner a Malta"
2. Follow-up contestuale sulla stessa conversazione (verifica memoria: "e in Francia?")
3. Creazione email: bozza singola per un partner + batch su un paese, con verifica avanzamento e revisione editoriale
4. Verifica risposte AI: coerenza con i dati reali del database (controllo incrociato con query dirette)
5. Uso Knowledge Base: domanda che richiede la KB e verifica che citi la fonte
6. Automazioni: stato missioni/autopilot, coda approvazioni (Cestinone), effetto del kill-switch AI attualmente attivo
7. Robustezza: richiesta ambigua, richiesta vuota, richiesta fuori scope

## Fase 3 — Report
Consegno un elenco ordinato per gravità:
- Bloccanti (pagina non usabile, errore, dato sbagliato)
- Funzionali (flusso incompleto, AI che non esegue o risponde male)
- UX/UI (layout, leggibilità, elementi duplicati o fuorvianti)
- Prestazioni (attese lunghe senza feedback)

Ogni voce con: pagina/scenario, cosa ho fatto, cosa mi aspettavo, cosa è successo, evidenza (screenshot/log), causa probabile e proposta di correzione.

## Note tecniche
- Playwright headless in sandbox su `http://localhost:8080`, script sotto `/tmp/browser/`; nessun file di progetto modificato.
- Verifiche dati incrociate con query di sola lettura sul database.
- Le chiamate AI consumano token reali: il kill-switch `cron_paused` blocca solo i job automatici, non le richieste manuali. La batteria della Fase 2 è volutamente contenuta (una dozzina di richieste).
- Al termine ti chiedo quali difetti correggere prima; nessuna modifica al codice senza tua approvazione.

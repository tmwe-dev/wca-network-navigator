# Piano di Refactoring e Consolidamento — WCA Network Navigator

Obiettivo: non aggiungere funzioni. Tagliare, consolidare, rendere unico ogni percorso critico, senza rompere il comportamento esistente.

## Verifiche fatte sul repository (stato reale, non stimato)

- 4.470 file tracciati, 150 Edge Functions, 416 migrazioni, 821 file sotto `src/v2`.
- `.env` è effettivamente tracciato in git. Contiene solo 5 chiavi: URL del backend, project id e chiave pubblica. **Nessuna chiave privata, nessun token segreto.** Non è un incidente di sicurezza, ma va comunque normalizzato.
- Gli accessi diretti al database fuori dai layer dati risultano 149 file, ma 126 stanno dentro `src/data` (che è il data layer legittimo) e 10 dentro `src/v2/io`. I bypass reali fuori layer sono pochi: circa 6-8 file (alcuni tool Command, observability, un file in `lib`, più i test).
- `any` presenti: circa 676 occorrenze. Chiamate `console.` residue: solo 10 file.

Conseguenza: alcune voci P0 dell'audit sono meno gravi del previsto, altre (Edge Functions, duplicazioni v1/v2, orfani, bundle) restano pienamente valide. Il piano riordina le priorità di conseguenza.

## Fase 0 — Igiene immediata

1. Togliere `.env` dal tracking e affidarsi a `.env.example` più variabili di ambiente. Nessuna rotazione chiavi necessaria (solo valori pubblici), ma va confermato con una scansione della cronologia che in passato non siano finiti valori diversi da questi cinque.
2. Rendere obbligatori prima del merge i controlli CI già esistenti (typecheck, strict, lint-ratchet, debt, audit sicurezza, function-auth, build, bundle guard, E2E smoke, CodeQL). Oggi la CI è ottima ma non blocca nulla.

## Fase 1 — Unica fonte autorevole per il percorso dati

3. Definire formalmente il confine: `src/data` più `src/v2/io` è l'unico punto che parla col database. Chiudere i pochi bypass reali rimasti (tool Command, observability, `lib`) spostandoli nel layer dati.
4. Attivare una regola di lint che vieta l'uso del client database fuori dai percorsi consentiti, così il debito non può riformarsi. Un audit periodico diventa un vincolo permanente.

## Fase 2 — Unica fonte autorevole per AI, prompt e knowledge base

È il punto che spiega meglio l'instabilità percepita degli agenti.

5. Mappare tutte le sorgenti di prompt, KB e memoria oggi attive (tabelle prompt operativi, personas, dottrina, prompt nel codice agente, prompt dentro le Edge Functions, file KB pubblici).
6. Dichiarare una gerarchia unica e non ambigua: database come fonte autorevole, codice solo come rete di sicurezza. Ogni altra copia viene marcata deprecata e poi rimossa.
7. Un solo runtime di esecuzione agente. Se oggi esistono due percorsi, uno diventa l'unico e l'altro un semplice ponte: due domande uguali devono dare sempre la stessa risposta.

## Fase 3 — Consolidamento Edge Functions

8. Inventario delle 150 funzioni per famiglia (email, scraping, AI, CRM, admin, cron, utility) con prova di utilizzo reale (chiamate dal frontend più log).
9. Spegnimento controllato di quelle senza chiamanti, dopo un periodo di osservazione. Nessuna cancellazione senza prova.
10. Uniformare per tutte quelle vive: autenticazione, CORS, contratto di errore, validazione input, logging. Tramite modulo condiviso, non copia-incolla.
11. Fusione delle famiglie realmente sovrapposte in funzioni parametriche, una famiglia alla volta con verifica funzionale dopo ogni fusione.

## Fase 4 — Chiusura v1 → v2 e rimozione duplicati

12. Elenco dei nomi presenti sia in v1 sia in v2: per ciascuno si decide quale versione sopravvive.
13. Rimozione dei duplicati esatti e riconciliazione dei quasi-duplicati.
14. Rimozione degli orfani solo dopo doppia prova (nessun import statico e nessun uso dinamico), a lotti piccoli e reversibili.
15. Rimozione degli adapter e dei bridge di compatibilità man mano che il lato v1 sparisce.

## Fase 5 — Qualità e prestazioni

16. Riduzione progressiva degli `any` a lotti per dominio, sfruttando il ratchet già presente perché il numero non possa risalire.
17. Spezzare le funzioni troppo lunghe e il nesting profondo solo nei file critici (invio email, orchestratori AI, batch, pipeline), con modifiche minime e locali.
18. Sostituire le ultime chiamate `console` col logger centralizzato.
19. Alleggerire il bundle: caricamento su richiesta delle librerie pesanti (3D, mappe, export Excel e ZIP, cattura immagini), eliminazione di una delle due librerie per i fogli di calcolo, abbassamento graduale del limite da 3.500 KB.

## Fase 6 — Semplificazione UX

20. Per ogni pagina operativa definire l'unica domanda a cui risponde ("cosa devo fare ora"), portando in primo piano l'azione principale e spostando il resto in livelli progressivi.
21. Ridurre alias e rotte legacy: ogni pagina raggiungibile da un solo indirizzo, i vecchi diventano redirect.

## Regole di esecuzione

- Un lotto alla volta, piccolo e reversibile. Nessun refactor opportunistico fuori dal lotto.
- Prima di toccare un nodo critico (invio email, orchestratori AI, memoria, batch, deduplica, auth, RLS, persistenza): mappa di impatto, poi modifica minima.
- Dopo ogni lotto: typecheck, lint, test e verifica fisica sulle pagine toccate.
- Nessuna riscrittura della storia delle migrazioni: eventuale consolidamento solo tramite baseline documentata.

## Ordine consigliato

Fase 0 → 1 → 2 → 3 → 4 → 5 → 6.

Le Fasi 0-2 fanno salire più rapidamente affidabilità e coerenza dell'AI; le Fasi 3-4 sono quelle che riducono davvero il costo di manutenzione.
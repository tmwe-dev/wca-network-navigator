# Piano: Applicazione del Protocollo Bonifica a WCA Network Navigator

## Obiettivo
Applicare il "Protocollo Bonifica v1.0" al progetto come metodo operativo permanente: strumenti di misura, inventario, tre lenti, quarantena, asportazione controllata, prove e fascicolo di consegna — senza rompere il comportamento esistente (Principio Madre).

## Stato attuale (già verificato nel progetto)
- Audit di complessità già eseguito (`.lovable/audits/complexity/`): 4130 file, 473 orfani candidati, 8 duplicati esatti + 9 near-dup, 82 file con DAL bypass, 977 `any`, 527 `console.*`, 154 edge functions.
- Esiste già `scripts/debt-budget.js`, lint-ratchet, baseline scorecard.
- Manca: strumentazione di "traffico reale" (Lente 2), registro di quarantena, fascicolo di consegna formale, finestre di osservazione dichiarate.

## Adattamento del rigore
Il sistema è un "sistema che consiglia" (CRM commerciale AI): quarantena obbligatoria sopra le 20 righe, esecuzione a specchio sui numeri esposti (lead scoring, conteggi), finestra di osservazione = 1 ciclo (30 giorni) dove possibile, altrimenti quarantena.

## Fasi di lavoro proposte

### Fase 0 — Congelamento e rete (setup strumenti)
1. Fotografia stato: script `scripts/bonifica/snapshot.mjs` che registra SHA, conteggi file/righe, lista dipendenze con versioni, schema DB → `.lovable/bonifica/snapshot-YYYYMMDD.json`.
2. Verifica rete di prove esistente: la suite attuale (unit + 66 E2E) funge da caratterizzazione; nessuna nuova feature entra durante i giri di bonifica.
3. Documento procedura di rollback: revert del commit singolo (git) + restore migration dove serve, con tempo stimato scritto.

### Fase 1 — Inventario (consolidamento)
1. Consolidare gli inventari esistenti (complexity audit, edge catalog, galaxy synapses) in un unico registro `.lovable/bonifica/inventario.md` per le 7 categorie del protocollo: punti di ingresso (rotte, cron, edge), superficie dati (tabelle), uscite (email/WA/LI), risorse esterne (ElevenLabs, IMAP, estensioni), interruttori (flag/config), dipendenze, obblighi (RLS, soft-delete, audit log).
2. Regola: nessuna voce esce dall'inventario senza decisione scritta accanto.

### Fase 2 — Le Tre Lenti (strumentazione)
1. **Lente 1 (raggiungibilità)**: già disponibile dall'audit statico — 473 orfani candidati da triage manuale.
2. **Lente 2 (traffico reale)**: nuovo strumento leggero —
   - Edge functions: tabella `edge_invocation_log` (o uso dei log esistenti) con contatore per function.
   - Frontend: hook `trackRouteUsage` che registra (via logger strutturato esistente) le rotte effettivamente visitate.
   - Finestra dichiarata: 30 giorni; codice non osservato per un ciclo intero → quarantena, non rimozione.
3. **Lente 3 (intento storico)**: per ogni candidato "morto", scheda con fonte (commit, memoria, ticket) compilata prima di qualunque taglio. Verdetto "non lo so" = non si taglia.
4. Matrice del verdetto applicata voce per voce in `.lovable/bonifica/verdetti.md`.

### Fase 3 — Classificazione
Ogni voce sospetta classificata in una delle 7 categorie (Morto, Zombie, Duplicato, Speculativo, Non ancora abitato, Impalcatura, Obbligatorio invisibile). Candidati già noti: 8 duplicati esatti, 45 overlap v1/v2, 473 orfani, flag/config mai usati.

### Fase 4 — Quarantena
1. Meccanismo standard: wrapper `quarantineLog(name)` che registra chi/quando/dati su ogni chiamata al pezzo sospetto, senza cambiarne il comportamento.
2. Registro `.lovable/bonifica/quarantena.md`: pezzo, data inizio, data scadenza, criterio di uscita ("se al GG/MM il registro è vuoto → rimozione").
3. Rotte/funzioni pubbliche (bridge estensioni, webhook): solo deprecazione annunciata, mai taglio diretto.

### Fase 5 — Asportazione
1. Solo dopo scadenza quarantena o verdetto "Morto" a tre lenti concordi.
2. Un pezzo per commit, diff di sola sottrazione, nessun refactor opportunistico (allineato al Codex e al Principio Madre).
3. Dalle foglie alla radice: dopo ogni giro si rifà la Lente 1 finché non produce più nulla.

### Fase 6 — Prova del contrario
1. Esecuzione a specchio sui numeri esposti: lead scoring, conteggi dashboard, KPI autopilot ricalcolati prima/dopo su dati reali; differenze spiegate o blocco.
2. Prova che le prove vedono l'assenza: guasto intenzionale su un campione di righe critiche → almeno un test deve fallire.
3. Rollback riprovato sulla versione bonificata.

### Fase 7 — Consegna (fascicolo)
Documento `.lovable/bonifica/fascicolo-YYYYMMDD.md` con le 8 voci obbligatorie: cosa tolto, perché (3 lenti), con quale prova, cosa NON toccato, quarantena residua con date, rollback, soglia di allarme, debito residuo.

### Fase 8 — Sorveglianza
Controllo error log vs snapshot per un ciclo completo; lettura contatori quarantena alle date dichiarate.

## Primo lotto concreto (dopo approvazione)
1. Creare struttura `.lovable/bonifica/` + script snapshot (Fase 0).
2. Strumentare Lente 2: contatore invocazioni edge + tracciamento rotte (Fase 2).
3. Compilare inventario consolidato e primi verdetti sugli 8 duplicati esatti (già provati byte-per-byte) come primo taglio sicuro.
4. Avviare quarantena sui primi 20 orfani candidati con contatore.

## Vincoli rispettati
- Nessuna rimozione di nodi critici (DAL, AI charter, journalistReview, soft-delete, RLS, edge AI) senza verdetto a tre lenti.
- `console.*` e `any`: tracciati come debito, non toccati in questa fase (già in debt budget).
- Interfacce verso estensioni (WA/LI/email bridge) mai tagliate senza preavviso.

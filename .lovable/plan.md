# V3 — Visione e perimetro: la piattaforma essenziale

Obiettivo concordato: una piattaforma che pesa il **5% della V2** (oggi 731 file TS/TSX, 151 edge function) e fa le cose principali bene, con codice leggero. Le migliorie arrivano dopo, una alla volta, solo se servono davvero.

## Le 6 sezioni principali (tutta la V3)

Non 26 maschere come oggi: **6 sezioni, circa 14 maschere reali**. Il resto o sparisce o torna nel Laboratorio V2 finché non serve.

```text
V3
├── 1. Contatti        — directory unica (contatti, biglietti, partner WCA),
│                        scheda contatto, scheda azienda. FATTO.
├── 2. Messaggi        — inbox unificata, conversazione, scrivi (con AI).
│                        Il cuore: il ciclo del messaggio.
├── 3. Da fare         — approvazioni + agenda + coda invii.
│                        "Cosa devo decidere io oggi". Una sola maschera.
├── 4. Command         — assistente AI in linguaggio naturale.
│                        Chiede, trova, propone. Non esegue senza ok.
├── 5. Tracciamento    — andamento + registro. Numeri essenziali, non cruscotti.
└── 6. Impostazioni    — canali email, operatori, AI (prompt essenziali).
```

Fuori dal perimetro V3 (restano accessibili dal **Laboratorio**, che punta alla V2, finché qualcuno non li chiede davvero): campagne A/B, pipeline Kanban, deep search, scraping, estensioni browser, WhatsApp/LinkedIn stealth, agenti vocali, duplicati/cestino avanzati, diagnostica.

## Strumenti: solo quelli necessari

| Area | V2 oggi | V3 |
|---|---|---|
| Edge function | 151 | ~10 (invio email, sync IMAP, classifica, genera bozza, agent-loop, command, directory, import) |
| Agenti AI | decine (registro + persona DB + cockpit) | **2**: Aurora (Command, testo) e l'agente di scrittura (generate/review email). Un solo prompt per agente, versionato nel Prompt Lab DB |
| Knowledge base | ~25 file + tabelle KB multiple | **3 documenti**: mappa app+pagine, schema tabelle/campi, regole commerciali (tono, stati, circuito) |
| Impostazioni | 155 chiavi | ~12 chiavi essenziali (firma, canale predefinito, orari invio, limiti giornalieri) |
| Librerie | three.js galaxy, grafici multipli, ecc. | le sole già in V3 + nient'altro finché non serve |

## Command: il suo ruolo nella V3

Command non è "un'altra pagina": è **il modo veloce di arrivare alle 6 sezioni**. Tre capacità, in questo ordine:

1. **Trova** — "mostrami i contatti di DHL in Germania" → apre la lista filtrata (si appoggia agli stessi dati delle maschere, niente motori duplicati).
2. **Sintetizza** — "cosa è successo con questo contatto?" → riassume storia e stato.
3. **Prepara** — "scrivi un follow-up" → bozza nella coda approvazioni. Mai invio diretto.

Niente pianificatore multi-agente, niente 30 tool: una manciata di tool dichiarati (cerca contatti, leggi scheda, conta, prepara bozza, naviga). Il prompt punta ai 3 documenti KB invece di ripetere regole.

## Come si costruisce (metodo fisso, già in uso)

Per ogni pezzo: funzione backend → modulo dati (`src/data/v3`) → hook → maschera → prova nel browser → rigenero la galassia V3 per verificare che non si formino grovigli. La galassia resta il nostro strumento di controllo: se una freccia salta un livello, si corregge subito.

## Ordine di lavoro proposto

1. **Messaggi** — inbox vera con sync email funzionante (è il prerequisito di tutto).
2. **Scrivi + approvazioni** — il ciclo completo: bozza AI → ok umano → invio → tracciato.
3. **Command** — sulle fondamenta dei primi due, con i 3 documenti KB.
4. **Tracciamento** — numeri essenziali.
5. **Sfoltimento** — le maschere V3 non essenziali (regole, classificazione, modelli, campagne, coda, pipeline separate) vengono fuse o spostate in Laboratorio.

## Dettagli tecnici

- Guscio, sidebar, standard grafico (tasti visibili, vetro blu/marrone, tabelle standard) restano quelli già decisi e documentati in `docs/v3/standard-maschere.md`.
- La V2 resta intatta e raggiungibile: nessuna cancellazione finché ogni funzione V3 non è verificata su dati veri.
- Peso atteso a fine percorso: ~40 file V3 vs 731 V2, ~10 edge function vs 151.

Approvando, parto dal passo 1 (Messaggi).

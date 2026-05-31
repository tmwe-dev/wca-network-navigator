## Obiettivo
Mettere ordine su agenti, istruzioni e strategie email post-attesa, senza inventare contenuti: si elimina il rumore, si collega ciò che già esiste e si crea UN solo luogo per istruire ogni agente e per definire le email di onboarding.

## A. Pulizia dati (database) — riduce la confusione
1. **Separare i frammenti KB dagli agenti reali.** Le 29 righe `role='assistant'` nella tabella `agents` che sono in realtà testi di knowledge base (es. "11. Glossario rapido", "🏢 Entità & Sistemi", "Numeri di performance", "TMWE S.r.l.") verranno marcate come archiviate (soft-delete, non distruttivo) così la lista agenti mostra solo i ~16 agenti operativi reali. Nessun contenuto perso: i testi restano già presenti come schede in KB.
2. **Deduplica prompt operativi** (Wake-Up Composer, Customer story, Recipient psychology, Post-send) tenendo una sola versione per nome+contesto.

## B. Un solo luogo per istruire gli agenti
3. **Trasformare AgentChatHub da sandbox a editor reale**: le istruzioni scritte per un agente salvano davvero su `agent_personas` (tono, regole, vocabolario, firma) e mostrano in chiaro quali tool quell'agente può usare (`agent_capabilities`). Niente più prompt hard-coded nel codice.
4. **Scheda "Chi fa cosa"** in cima alla pagina Agenti: per ogni agente reale → ruolo, canale, cosa può fare, dove le sue istruzioni vengono effettivamente usate. Tabella generata dai dati, non statica.

## C. Strategie email post-circuito di attesa (in un unico posto governabile)
5. **Cliente che HA scritto** → estendere `funnemail_autoresponder_templates` come libreria di template di onboarding governabili da UI (oltre ai 2 "ricevuto" attuali), editabili e attivabili per fase. Solo struttura: i testi li definisci tu.
6. **Cliente che NON riscrive dopo X giorni** → collegare davvero la tabella `wake_up_rules` (oggi vuota e inutilizzata) a una UI dove definisci le regole (giorni di silenzio, score minimo, canale, template) e al motore di outreach che le esegue. Le 3 schede KB `followup` esistenti diventano i template di riferimento.

## D. Semplificazione navigazione
7. Raggruppare le 5 pagine sovrapposte sotto un'unica voce "Agenti" con sotto-schede: **Chi fa cosa · Istruzioni (persona+capability) · Routing · Email & Cadenze**. Nessuna logica nuova, solo riorganizzazione.

## Note tecniche
- Tutte le rimozioni sono soft-delete (rispetta il vincolo "no physical delete").
- Le migrazioni DB toccano nodi critici (personas, outreach): mappa impatto prima, modifica minima e reversibile.
- Nessun testo commerciale inventato: l'AI fornisce solo i contenitori e i collegamenti; i contenuti li valida/scrivi tu.

## Cosa decidi tu
Confermi questo ordine? Posso partire dalla **fase A (pulizia)** che è la più urgente e dà subito chiarezza, e poi proseguire con B, C, D in autonomia.
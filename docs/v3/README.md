# V3 — Fase 0 (analisi)

Tre documenti, nessun codice applicativo. Vanno letti in ordine.

1. [Inventario funzionale](./inventario-funzioni.md) — il registro di tutto ciò che il sistema sa fare, con prova d'uso reale e destino (Nucleo / Laboratorio / Duplicato / Verifica). È il contratto che garantisce che nulla vada perso.
2. [Contratto di pagina](./contratto-pagina.md) — l'unico standard strutturale delle maschere V3: una top bar, un header, filtri a sinistra, workflow a destra, tre soli tipi di pagina.
3. [Mappa di innesto](./mappa-innesto.md) — le 22 pagine della V3, con tipo, domanda, filtri e azioni, e la corrispondenza con le ~150 rotte V2 che sostituiscono.

4. [Foglio delle decisioni](./decisioni.md) — cosa si tiene, cosa esce, cosa si rimuove. **Chiuso il 2026-08-30**: un solo classificatore, acquisizione lead ferma in V2, voce abbandonata, sorte della V2 rinviata a Modulo 7 chiuso.

Idea guida: la V3 non si scrive da zero e non migra la V2. **Estrae** dal sistema esistente il ciclo del messaggio — contatto, messaggio, comprensione, risposta, programmazione, tracciamento — e lascia fuori la strumentazione.

Stato: Fase 0 completata e decisioni chiuse. Il passo successivo è il piano del Modulo 1 (guscio `src/v3` + identità).

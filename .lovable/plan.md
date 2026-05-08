# Fix container Funnemail Inbox reader

## Problema osservato
Nello screenshot di `/v2/inbox`, l'oggetto della mail ("Candidatura spontanea - logistica") va a capo **una lettera per riga**. Anche "Tutte" nella sidebar è strozzata, ma il caso grave è il pannello di lettura.

## Causa
In `src/components/outreach/EmailDetailView.tsx` (riga 128) la riga 1 dell'header è:

```
[avatar 40px]  [identità + subject  flex-1 min-w-0]  [barra azioni  flex-shrink-0]
```

La barra azioni di destra contiene 9 bottoni (Letto/Rispondi/ReplyAll/Inoltra/DeepSearch/ImageOff/Safe/Faithful/Chiudi) ed è marcata `flex-shrink-0`. A 1111px di viewport, con sidebar globale + colonna lista (~32%), al reader restano ~700px: la barra azioni occupa quasi tutto, lasciando alla colonna identità ~40-60px → l'`<h3>` con `break-words` va a capo per ogni glifo.

Inoltre `senderDetail` e brand sono sulla stessa riga dell'azioni (gap-x-2 wrap), quindi quando l'azioni-bar è larga schiaccia tutto.

## Cosa cambia (UI-only, nessuna logica)
File unico: `src/components/outreach/EmailDetailView.tsx`

1. **Spostare la barra azioni su una riga propria** sopra (o sotto) la riga identità, in modo che identità + subject usino l'intera larghezza del pannello.
2. La nuova riga azioni:
   - `flex flex-wrap items-center gap-1 justify-end`
   - rimossa `flex-shrink-0` rigido (i bottoni possono wrappare se serve)
   - mantiene esattamente gli stessi bottoni, handler, varianti, titoli — niente cambi di logica
3. La riga identità diventa: `[avatar] [brand + senderDetail + data + h3 subject]` su `flex-1 min-w-0`, così l'`<h3>` ha tutta la larghezza disponibile e non spezza più per lettera.
4. Mantiene `truncate` su brand/senderDetail e `break-words` su subject (ora finalmente utili invece di pittoreschi).
5. Riga 2 metadata (3 colonne) e Dettagli tecnici restano invariati.

## Out of scope
- Nessuna modifica a `FunnemailMailList`, `FunnemailInboxPage`, hook, DAL, edge functions.
- Nessuna modifica al comportamento dei bottoni (mark-as-read, navigate, viewMode, blockRemote, deep search).
- Nessun refactor della classificazione, attachments, EmailHtmlFrame.
- La sidebar sinistra ("Tutte"/"Assegna gruppo") non viene toccata in questo intervento — è un secondo problema (colonna lista pinch-out a viewport stretto). Se vuoi, lo affronto in un secondo passaggio dedicato dopo aver verificato il fix del reader.

## Verifica
- Aprire `/v2/inbox`, selezionare la mail "Candidatura spontanea - logistica".
- Subject su una riga (o al massimo 2 word-wrap), non più per-lettera.
- Bottoni azioni allineati a destra; su viewport < 900px wrappano sotto invece di schiacciare l'identità.
- Light + dark mode invariati (uso degli stessi token/`variant`).

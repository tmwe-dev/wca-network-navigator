# V3 — Estrarre il sistema semplice che c'è già dentro

## Risposta diretta alla domanda

Sì, conviene una V3. Ma non una V3 "nuova": una V3 **per estrazione**. Si crea un guscio pulito e si tirano dentro, uno alla volta, solo i pezzi che passano un test: "serve al sistema di comunicazione?". Tutto il resto resta dov'è finché non muore da solo.

E la base da cui ripartire, guardando tutto quello che c'è, è una sola: **il ciclo del messaggio**.

```text
CONTATTO → MESSAGGIO IN ENTRATA → CAPISCI → DECIDI → RISPONDI/PROGRAMMA → TRACCIA
```

Tutto il resto del sistema (galassia, prompt lab, arena, harmonizer, agent autopilot, TMWE, sherlock, super-mario, optimus) è **strumentazione intorno a questo ciclo**, non il ciclo. È lì che si è accumulata la complessità.

## Perché la V2 non è la base

Verificato: `src/v2` conta 103.078 righe ma importa **232 percorsi distinti** da `src/components` (104.833 righe di V1). La V2 non è mai diventata autonoma — è un secondo strato appoggiato sul primo. Ci sono anche due router (`App.tsx` e `v2/routes.tsx`) e 91 pagine sotto `v2/ui/pages`. Continuare a "migrare V1 → V2" significa portarsi dietro il debito. Per questo la V3 va fatta per estrazione, non per migrazione.

## Il nucleo V3 (quello che non si perde mai)

Sette moduli, in ordine di dipendenza:

1. **Identità & accesso** — whitelist, ruoli, operatori. Già solido, si copia quasi com'è.
2. **Contatti** — anagrafica unica, dedup, soft-delete. Il cuore dati.
3. **Messaggi** — ingest email/WhatsApp/LinkedIn, thread, allegati. Un solo modello di messaggio.
4. **Comprensione** — un solo classificatore: chi scrive, di cosa, quanto urge, cosa vuole.
5. **Risposta** — un solo generatore + editorial review obbligatorio, multicanale.
6. **Programmazione** — cadenze, follow-up, agenda, code di invio.
7. **Tracciamento** — pipeline, esiti, log decisionale.

Sopra ai sette: **un solo cervello conversazionale** (Command) che sa fare tutto quello che sanno fare i sette moduli, tramite tool. Non nove cervelli.

## Cosa resta fuori dal nucleo (e non viene buttato)

Resta dov'è, in una zona chiaramente marcata "laboratorio": galassia, prompt lab, arena, AI test hub, harmonizer, sherlock, super-mario, optimus, decision dashboard, TMWE/Findair, agent autopilot. Nessuna cancellazione ora: la V3 semplicemente non li ospita. Se dopo tre mesi nessuno li apre, si eliminano con i dati alla mano.

## Sì: prima si analizza tutto, poi si tocca un pezzo alla volta

L'ordine è questo, e la Fase 0 è tutta analisi — non si scrive una riga di applicazione finché non è finita.

### Fase 0.A — Censimento funzionale completo (nessuna funzione si perde)

Si produce un unico registro, `docs/v3/inventario-funzioni.md`, con una riga per ogni capacità reale del sistema — non per file, ma per **cosa sa fare**. Per ciascuna:

| Campo | Esempio |
|---|---|
| Capacità | "Classifica una email in arrivo e assegna il gruppo mittente" |
| Dove vive oggi | pagina, hook, funzione edge, tabelle toccate |
| Usata davvero? | prova da log di invocazione, non da grep |
| Destino | Nucleo V3 / Laboratorio / Duplicato di X / Morta |

Questo registro è il contratto: **nessun modulo si dichiara migrato se una sua riga del registro non è coperta.** È la risposta a "salvaguardando le funzioni": la salvaguardia è la lista, non la memoria.

### Fase 0.B — Standard di pagina V3 (prima delle pagine, non dopo)

Il caos della V2 nasce proprio da qui: oggi convivono `PageTitleHeader` (22 pagine), `StandardPageFrame` (2 pagine), `ExploreContextHeader`, più header orfani. Tre standard = nessuno standard.

Per la V3 si definisce **un solo contratto di pagina**, scritto prima di costruire qualsiasi maschera:

```text
┌─ Top bar globale (fissa, unica) ────────────────────┐
│ ☰   Titolo pagina                    stato · azioni │
├─────────┬───────────────────────────────┬───────────┤
│ Filtri  │  Header di pagina + toolbar   │ Workflow  │
│ (sx,    │  ─────────────────────────────│ (dx,      │
│ solo    │  CONTENUTO                    │ solo      │
│ filtri) │  (lista / dettaglio / form)   │ azioni)   │
└─────────┴───────────────────────────────┴───────────┘
                    ✦ AI sempre in alto a destra della maschera
```

Regole non negoziabili del contratto:
- Un solo componente header. Niente varianti, niente eccezioni "per questa pagina".
- Sinistra = solo filtri. Destra = solo workflow/azioni. Mai contenuto.
- Ogni pagina risponde a **una sola domanda** ("cosa devo fare ora") e la sua azione principale è visibile senza scroll.
- Tre soli tipi di maschera: **Lista**, **Dettaglio**, **Operativa** (canvas tipo Cockpit/Command). Ogni pagina V3 dichiara il suo tipo.
- Mobile: filtri e workflow diventano drawer, il contenuto resta intero.
- Nessun colore fuori dai token; badge e stati da un unico set.

Il contratto vive in `src/v3/app/pageContract.ts` + `PageFrame.tsx`, ed è coperto da una regola di lint: una pagina V3 che non usa `PageFrame` non compila.

### Fase 0.C — Mappa di innesto

Per ognuno dei sette moduli si dichiara in anticipo: quali pagine avrà, di che tipo (Lista/Dettaglio/Operativa), quali filtri a sinistra, quali azioni a destra. Un foglio solo, prima di scrivere. Così quando si innestano gli elementi si sa già dove vanno.

## Metodo: come si costruisce senza rompere

- La V3 vive in `src/v3` con un proprio router, accessibile da subito su un percorso dedicato. V1 e V2 continuano a funzionare in parallelo per tutto il tempo.
- Un modulo alla volta: si copia il codice che serve dentro `src/v3/modules/<nome>`, si ripulisce mentre si copia, e da quel momento **la V3 non importa più nulla da `src/components` o `src/v2`**. Regola ESLint che lo impedisce, come già fatto per l'accesso diretto al DB.
- Il backend non si tocca nella prima parte: stesse tabelle, stesse funzioni edge. Solo l'accesso passa dal Data Access Layer del modulo.
- Ogni modulo è "finito" quando: le righe del registro che gli competono sono tutte coperte, la sua pagina rispetta il contratto, i dati sono corretti, e ha zero import fuori dal proprio confine.
- Solo quando tutti e sette i moduli sono in V3 si spegne il router V1/V2 — e i file restano nel repo un ciclo intero prima della rimozione.


## Ordine dei moduli (dal più semplice)

| # | Modulo | Perché in questa posizione | Rischio |
|---|---|---|---|
| 1 | Identità & accesso | Nessuna dipendenza, già pulito, fa da fondazione | Basso |
| 2 | Contatti | Tutto il resto vi si appoggia; regole dedup già mature | Basso |
| 3 | Messaggi (lettura) | Sola lettura: si può verificare senza inviare niente | Basso |
| 4 | Comprensione | Un classificatore unico al posto dei rami paralleli | Medio |
| 5 | Risposta | Tocca l'invio reale — dopo che i primi quattro sono stabili | Alto |
| 6 | Programmazione | Cadenze e code, dipende da 5 | Medio |
| 7 | Tracciamento | Pipeline e log, si chiude per ultimo | Basso |

## Piani separati, uno per modulo

Questo è il piano quadro. Ogni modulo avrà poi il suo piano dedicato, autonomo e approvabile a sé, con: cosa si copia, cosa si riscrive, cosa si abbandona, come si verifica che non si è perso niente. Così se un modulo si rompe, si ripara da solo senza bloccare gli altri — che è esattamente il punto che hai sollevato.

In parallelo restano validi i due audit già fatti (Integrazioni e Cervello AI): le loro fasi a rischio nullo/basso — codice motore morto, doppio hop, gateway unico — si possono eseguire subito sul sistema attuale, perché riducono ciò che poi va copiato in V3.

## Prossimo passo che propongo

**Fase 0 sola, tutta analisi**: il registro completo delle capacità (0.A), il contratto di pagina V3 scritto e approvato (0.B) e la mappa di innesto dei sette moduli (0.C). Zero codice applicativo, zero rischio. Solo quando quei tre documenti sono approvati si apre il piano del Modulo 1 (guscio `src/v3` + identità).

## Note tecniche

- `src/v3/` con struttura `app/` (router, layout, shell), `modules/<nome>/{ui,hooks,dal}/`, `shared/` (solo design system e utility pure).
- Regola ESLint `tmwe/v3-no-legacy-import`: blocca ogni import da `@/components` e `@/v2` dentro `src/v3`.
- Il design system (`src/design-system`, 692 righe) e le primitive shadcn sono l'unica eredità condivisa consentita.
- Query key centralizzate e logger strutturato restano gli standard, ereditati per copia.
- Nessuna migrazione DB in questa fase: la V3 legge lo schema esistente attraverso il proprio DAL.

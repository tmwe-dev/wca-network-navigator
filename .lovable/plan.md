
Obiettivo approvato: costruire una nuova Home 3D come ingresso principale dell’app, senza eliminare nulla sotto, ma comprimendo la complessità in 8 mondi navigabili, con copy orientato all’azione.

1. Tesi del prodotto da tradurre nella Super Home
La nuova home non deve mostrare “tutte le pagine”.
Deve mostrare 8 mondi chiari, ciascuno con un verbo e un risultato:

- Cockpit → Scrivi e avvia outreach
- Acquisition → Scarica e arricchisci dati
- Network → Gestisci relazioni partner
- Prospects → Scopri e qualifica opportunità
- Campaigns → Seleziona e lancia campagne
- Contacts → Organizza i contatti
- Operations → Coordina i processi interni
- System → Configura e controlla il sistema

Questa tassonomia è più forte di quella attuale, perché oggi la sidebar mescola aree operative, legacy e strumenti.

2. Cosa emerge dal codice attuale
Le sezioni non sono doppioni perfetti, ma sono stratificate:

- `Operations` = centro tecnico di download/WCA, job, deep search, alias, stato globale.
- `Global` = ingresso semplificato al download con chat + globo.
- `Partner Hub` / `Campaigns` = due porte diverse sul mondo partner.
- `Prospect Center` = mondo separato e forte per prospect/scouting.
- `Contacts` = anagrafica e dettaglio contatti.
- `Hub Operativo` = coda attività e coordinamento per fonte.
- `Cockpit` = centro premium AI/outreach, oggi il template più maturo.
- `Workspace` + `Sorting` = ancora vivi nel codice e nei flussi, ma concettualmente legacy.

Conclusione: la Super Home deve semplificare sopra questa architettura, non rifarla.

3. Piano informativo: come mappare le pagine ai nuovi mondi
Ogni card porta a una rotta primaria chiara:

- Cockpit → `/cockpit`
- Acquisition → `/operations`
- Network → `/partner-hub`
- Prospects → `/prospects`
- Campaigns → `/campaigns`
- Contacts → `/contacts`
- Operations → `/hub`
- System → `/settings`

Mondi secondari assorbiti mentalmente:
- `Global` entra sotto Acquisition
- `Reminders` entra sotto Operations/Contacts
- `Diagnostics` e `Guida` entrano sotto System
- `Workspace` e `Sorting` restano attivi ma non visibili in home

4. Struttura UX della nuova Home 3D
Layout consigliato:

```text
[ header minimale ]

        stato vivo del sistema
             (centro)

   card 3D orbitanti sul bordo esterno
   una frontale, due laterali percepibili

[ descrizione breve della card attiva ]
[ CTA: Entra ]

[ strip globale KPI sintetica ]
```

Regole UX:
- solo 8 card
- una sola card protagonista alla volta
- testo principale in formato “Verbo + risultato”
- nessun percorso legacy in primo piano
- home pensata anche per utenti inesperti

5. Architettura visiva consigliata
Tecnologia:
- React + Framer Motion
- CSS 3D (`perspective`, `transform-style: preserve-3d`)
- blur, glow, gradient, parallax leggero
- niente Three.js nella prima versione

Perché:
- effetto wow sufficiente
- più stabile e leggero
- più facile da mantenere
- coerente col sistema attuale

Riferimenti da riusare:
- estetica Cockpit come standard visivo
- atmosfera/glow del mondo Campaigns/Globe
- contrasto alto, glassmorphism leggibile

6. Cosa costruire
A. Nuova pagina Home 3D
- nuova pagina dedicata, es. `SuperHome3D`
- nuova rotta `/`
- `Operations` spostato definitivamente a `/operations`

B. Modello dati delle card
- array centralizzato con:
  - titolo breve
  - verbo+risultato
  - descrizione secondaria
  - icona
  - KPI sintetici
  - rotta target
  - stile cromatico

C. Componente carosello orbitale
- card disposte ad anello
- rotazione via click, drag, wheel, tastiera
- card frontale evidenziata
- profondità simulata con scala/opacità/blur/translateZ

D. Centro pagina = mission control
- stato vivo del sistema, ma leggero:
  - contatti
  - campagne
  - attività
  - job attivi
- non un pannello operativo completo
- serve a dare senso, non a sostituire le pagine

E. Strip KPI globale
- una riga compatta sotto o sopra:
  - nuovi contatti
  - partner attivi
  - campagne in corso
  - attività aperte

7. Da dove prendere i dati
Per la home servono solo query leggere e già esistenti:
- attività aperte da `useAllActivities`
- job attivi da `useDownloadJobs`
- prospect da `useProspectStats`
- contatti/outreach da `useCockpitContacts` o contatori dedicati
- partner da hook già usati da `Campaigns` / `Partner Hub`

Regola:
- niente query pesanti o viste complesse nella prima home
- KPI sintetici, non liste operative

8. Impatto su navigazione e routing
Va riallineata la struttura attuale, oggi incoerente:
- nella sidebar `Operations` punta ancora a `/`
- `Workspace` e `Sorting` sono ancora in primo livello
- la nuova Home deve diventare la vera porta principale

Piano:
- `/` = Super Home
- `/operations` = area tecnica esistente
- sidebar aggiornata per riflettere la nuova gerarchia
- `Workspace` e `Sorting` tolti dal primo piano, ma non rimossi

9. Cosa NON buttare via
Nulla di operativo.
Il piano conserva:
- tutte le route esistenti
- tutti i flussi dati
- tutte le pagine interne
- tutte le logiche AI, jobs, import, campagne

Quello che cambia è:
- il livello di accesso
- la chiarezza dei mondi
- la gerarchia mentale
- la grafica d’ingresso

10. Ordine di implementazione consigliato
Fase 1 — Mappa definitiva dei mondi
- consolidare nomi, copy e rotta primaria per le 8 card
- definire quali pagine secondarie stanno sotto ogni mondo

Fase 2 — Fondazione tecnica
- introdurre nuova pagina `/`
- spostare l’attuale ingresso tecnico a `/operations`
- definire modello card + KPI

Fase 3 — Carosello 3D
- costruire anello orbitale
- animazioni cinematiche
- focus sulla card attiva
- CTA di accesso

Fase 4 — Mission control centrale
- stato sintetico del sistema
- KPI globali
- microcopy di orientamento

Fase 5 — Rifinitura navigazione
- aggiornare sidebar, command palette e accessi
- nascondere legacy dal primo livello
- mantenere continuità interna

11. Risultato atteso
Una “super porta” sopra il software, che:
- rende il prodotto leggibile in pochi secondi
- valorizza le parti più forti senza distruggere nulla
- usa il miglior linguaggio visivo già presente
- prepara una futura unificazione vera delle sezioni duplicate
- trasforma il sistema da “potente ma frammentato” a “potente ma guidato”

12. Decisione progettuale finale
Procederei con questa impostazione precisa:
- nuova home = 8 mondi navigabili
- copy principale = verbo + risultato
- no legacy visibile in home
- centro pagina = mission control sintetico
- stile visivo = standard Cockpit + profondità orbitale
- tecnologia = Framer Motion + CSS 3D, non Three.js nella prima release

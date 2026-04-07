*Manuale operativo per il ripristino di sistemi software complessi*

Volume I --- Serie Enterprise Software Engineering

Prefazione
==========

Questo libro nasce da una constatazione empirica ormai indiscutibile:
l\'introduzione dell\'intelligenza artificiale nei processi di sviluppo
software ha accelerato la produzione di codice a un ritmo senza
precedenti, ma ha anche moltiplicato, nella stessa proporzione, la
fragilità strutturale dei sistemi prodotti. Un software costruito in
gran parte con assistenti AI è, nella stragrande maggioranza dei casi,
un sistema che funziona in superficie e collassa in profondità.

Il problema non risiede nell\'AI in sé. Risiede nel fatto che l\'AI, per
sua natura, genera soluzioni locali coerenti ma architetturalmente
miopi. Produce codice che risolve il prompt, non il sistema. Il
risultato è un accumulo di decisioni locali ottimali che, sommate,
producono un insieme globale caotico.

Questo manuale è stato scritto per chi si trova davanti a un software in
crisi e deve riportarlo a uno stato di affidabilità enterprise. Non è un
testo introduttivo. Presuppone che il lettore abbia già vissuto la
frustrazione di un codice che si rompe ogni volta che lo si tocca, di
flussi utente che funzionano a giorni alterni, di bug che scompaiono per
ricomparire altrove.

Il metodo presentato in queste pagine è stato distillato da centinaia di
progetti reali. Non contiene opinioni. Contiene procedure. Ogni fase è
verificabile, ogni output è misurabile, ogni criterio di uscita è
oggettivo. Il lettore che segue il protocollo con disciplina ottiene un
sistema stabile. Il lettore che lo adatta a proprio piacimento ottiene,
al massimo, un sistema meno instabile.

> Il recupero di un software non è un atto creativo. È un atto
> chirurgico.

Capitolo I --- I Principi Non Negoziabili
=========================================

Prima di qualunque intervento tecnico, il responsabile del recupero deve
interiorizzare un insieme di principi che governano ogni decisione
successiva. Questi principi non sono linee guida. Sono leggi. La loro
violazione compromette sistematicamente l\'esito del progetto,
indipendentemente dalla qualità del lavoro svolto nelle singole fasi.

1.1 Le sette leggi del recupero
-------------------------------

> **Legge 1.** *Durante il recupero non si aggiungono funzionalità. Ogni
> nuova feature introdotta in fase di ripristino estende il perimetro
> del problema e rende impossibile distinguere i bug preesistenti dai
> bug introdotti.*
>
> **Legge 2.** *Non si esegue mai un refactor globale. Il refactor
> globale è l\'illusione del controllo. In realtà, sostituisce un
> sistema instabile conosciuto con un sistema instabile ignoto.*
>
> **Legge 3.** *Ogni modifica deve essere verificabile in isolamento. Se
> una modifica non può essere testata separatamente, non è una modifica:
> è una scommessa.*
>
> **Legge 4.** *Si lavora su un flusso completo alla volta. La
> concorrenza tra interventi paralleli produce interferenze che
> moltiplicano esponenzialmente i tempi di debugging.*
>
> **Legge 5.** *Si distinguono sempre quattro strati: interfaccia
> utente, stato applicativo, logica di dominio, dati persistenti. La
> confusione tra questi strati è la causa prima di ogni sistema
> irrecuperabile.*
>
> **Legge 6.** *L\'intelligenza artificiale esegue, non decide.
> L\'architettura è responsabilità umana. L\'AI può scrivere una
> funzione, ma non può stabilire dove quella funzione debba vivere.*
>
> **Legge 7.** *Nessun intervento è considerato completo finché non è
> documentato. Il codice non documentato, in un contesto di recupero, è
> codice che dovrà essere recuperato una seconda volta.*

1.2 Le tre illusioni da estirpare
---------------------------------

Ogni progetto di recupero fallisce per una delle tre illusioni seguenti,
che il responsabile deve riconoscere e combattere attivamente.

### La prima illusione: il rewrite

Quando il codice sembra irrecuperabile, la tentazione di riscrivere
tutto da zero è irresistibile. È anche, quasi sempre, sbagliata. Un
rewrite richiede di ricostruire non solo il codice, ma tutta la
conoscenza implicita accumulata nei bug risolti nel tempo. Il nuovo
sistema commetterà gli stessi errori del vecchio, più una nuova
generazione di errori originali.

### La seconda illusione: la magia dell\'AI

Il pensiero che basti un buon prompt per ottenere un sistema pulito è
una forma sofisticata di autoinganno. L\'AI risolve problemi locali di
qualità sorprendente, ma non possiede una rappresentazione coerente
dell\'intero sistema. Affidarle decisioni architetturali equivale ad
affidarle la scrittura di un libro consegnandole una pagina alla volta
senza indice.

### La terza illusione: la velocità

Un progetto di recupero sembra sempre più lento di quanto dovrebbe
essere. Questa percezione è sbagliata. La velocità apparente dello
sviluppo assistito da AI nasconde un debito tecnico che, in fase di
recupero, viene riscosso con gli interessi. Accettare la lentezza del
metodo è la condizione per uscire dal caos.

Capitolo II --- Fase 0: Fotografia dello Stato Iniziale
=======================================================

Prima di toccare qualunque riga di codice, il sistema deve essere
fotografato. Questa fase, spesso trascurata, è la base di tutte le
successive. Senza una baseline misurabile, è impossibile sapere se le
modifiche successive migliorano o peggiorano la situazione.

2.1 Backup integrale
--------------------

Il primo atto è la creazione di un backup completo, versionato e
immutabile, di tutto il codice, del database, delle configurazioni di
ambiente e degli asset statici. Il backup deve essere conservato in un
luogo fisicamente separato dal sistema in lavorazione e deve essere
testato, ossia si deve verificare che sia effettivamente ripristinabile.
Un backup non testato non esiste.

2.2 Metriche di salute
----------------------

Occorre stabilire un piccolo insieme di metriche oggettive che
descrivono lo stato di salute del sistema. Queste metriche saranno
ricalcolate al termine di ogni fase e costituiranno l\'unico giudice
della qualità del lavoro svolto. Le metriche raccomandate sono: numero
di errori per giorno nei log di produzione, numero di flussi utente
critici completabili senza intervento manuale, percentuale di copertura
dei test automatici, tempo medio di risposta delle API principali,
numero di dipendenze circolari rilevate dagli strumenti statici, numero
di moduli privi di tipizzazione.

2.3 Dichiarazione di freeze
---------------------------

Lo sviluppo di nuove funzionalità deve essere sospeso formalmente.
Questa decisione non è tecnica: è organizzativa. Deve essere comunicata
a tutti gli stakeholder, messa per iscritto, e accompagnata da una stima
realistica della durata del recupero. Senza freeze, ogni fase successiva
sarà contaminata da modifiche esterne che renderanno impossibile isolare
le cause dei problemi.

Capitolo III --- Fase 1: Contenimento del Degrado
=================================================

L\'obiettivo di questa fase, che dura tipicamente da uno a due giorni, è
fermare l\'emorragia. Il sistema deve smettere di peggiorare. Non si
cerca ancora di migliorarlo: si cerca solo di renderlo osservabile e
stabile al livello minimo necessario per lavorarci sopra.

3.1 Branch di recupero
----------------------

Si crea un branch dedicato, nominato secondo la convenzione
recovery/nome-progetto. Questo branch sarà la linea di sviluppo
principale per tutto il periodo di recupero. Il branch di produzione non
viene toccato, se non per hotfix critici, che dovranno poi essere
riportati nel branch di recupero con estrema cautela.

3.2 Attivazione del controllo statico
-------------------------------------

Gli strumenti di analisi statica devono essere attivati nella
configurazione più severa tollerabile. Per progetti JavaScript o
TypeScript, questo significa ESLint con regole strict e TypeScript in
modalità strict con noImplicitAny, strictNullChecks,
noUncheckedIndexedAccess attivi. Per Python, significa mypy in strict
mode, ruff con regole severe, black per la formattazione. Per altri
linguaggi, gli equivalenti locali. L\'obiettivo non è correggere subito
tutti gli errori segnalati, ma renderli visibili.

3.3 Error boundary e logging strutturato
----------------------------------------

Un global error boundary deve essere installato sia lato client sia lato
server. Ogni eccezione non gestita deve essere catturata, registrata e,
se possibile, inviata a un sistema di error tracking remoto. Il logging
deve essere strutturato, ossia ogni record deve essere un oggetto JSON
con campi standard: timestamp, livello, modulo, identificativo utente,
identificativo sessione, messaggio, contesto. I log testuali non
strutturati sono inutilizzabili per l\'analisi.

3.4 Criterio di uscita
----------------------

La Fase 1 è considerata completa quando, e solo quando, il codice
compila senza errori, ogni eccezione produce una traccia visibile nei
log, e il branch di recupero è stabile sul ramo principale. Nessuna
delle fasi successive può iniziare prima che questi tre criteri siano
soddisfatti.

Capitolo IV --- Fase 2: Radiografia del Sistema
===============================================

Questa è la fase più sottovalutata e, allo stesso tempo, la più
determinante. L\'obiettivo è costruire una rappresentazione oggettiva
del sistema reale, non del sistema immaginato dai suoi autori. Ciò che
si è convinti di avere costruito e ciò che si è effettivamente costruito
raramente coincidono.

4.1 Mappatura dei moduli
------------------------

Per ogni cartella del codice si produce una scheda che descrive: la
funzione dichiarata del modulo, le sue dipendenze in ingresso e in
uscita, gli input e gli output attesi, i file critici, e una valutazione
preliminare dello stato. La mappatura non si ferma alla descrizione
formale. Deve includere anche le anomalie rilevate: duplicazioni, file
apparentemente morti, file con naming ambiguo, file di dimensioni
sproporzionate.

4.2 Tracciamento dei flussi utente
----------------------------------

Un flusso utente è una sequenza di azioni che parte da un\'intenzione e
termina con un risultato. Per ogni flusso critico del sistema si traccia
il percorso effettivo: quale componente dell\'interfaccia riceve
l\'input, quale funzione lo elabora, quale chiamata API lo trasmette al
backend, quale livello di logica lo valida, quale query lo salva in
database, quale risposta viene restituita, come viene aggiornato lo
stato dell\'interfaccia. Questo tracciamento deve essere fatto su codice
reale, con il debugger, non su diagrammi teorici.

4.3 Schema dati effettivo
-------------------------

Lo schema dati reale è, in un software costruito con AI, quasi sempre
diverso dallo schema dati documentato. Occorre generare lo schema reale
direttamente dal database, confrontarlo con i modelli definiti nel
codice, e identificare ogni divergenza. Campi presenti nel database ma
non nel codice indicano funzionalità abbandonate. Campi presenti nel
codice ma non nel database indicano funzionalità mai completate.
Entrambi i casi sono fonti di bug futuri.

4.4 Lista dei problemi prioritizzati
------------------------------------

Al termine della radiografia si produce un unico documento che elenca
tutti i problemi rilevati, ordinati per impatto e per rischio.
L\'impatto misura quanto il problema compromette la funzionalità del
sistema. Il rischio misura quanto il problema può peggiorare se non
affrontato. La priorità è il prodotto delle due dimensioni. Questo
documento è il piano di lavoro di tutte le fasi successive.

Capitolo V --- Fase 3: Definizione dell\'Asse di Verità
=======================================================

In ogni software disordinato esistono versioni contraddittorie della
stessa informazione. Lo stesso concetto, ad esempio un utente o un
ordine, è rappresentato in modi diversi nel database, nei modelli del
backend, nei contratti API e nelle strutture di stato del frontend.
Queste rappresentazioni non concordano mai del tutto. Le divergenze sono
la principale fonte di bug sistemici.

5.1 La scelta del riferimento
-----------------------------

Il responsabile del recupero deve scegliere un unico riferimento
canonico per ogni entità del dominio. Le opzioni sono tre: lo schema del
database, il modello di dominio nel backend, il contratto API. La scelta
dipende dalla natura del sistema, ma la regola è che uno e uno solo di
questi livelli è fonte di verità. Gli altri ne derivano.

5.2 Eliminazione delle duplicazioni di stato
--------------------------------------------

Identificato l\'asse di verità, ogni rappresentazione duplicata deve
essere eliminata o esplicitamente derivata dal riferimento canonico.
Questo principio si applica anche allo stato del frontend: ogni dato
mostrato all\'utente deve avere un\'unica origine identificabile. Lo
stato duplicato è la causa più frequente delle incoerenze percepite
dall\'utente finale.

5.3 Conseguenze architetturali
------------------------------

La definizione dell\'asse di verità ha conseguenze profonde
sull\'architettura. Alcuni moduli si riveleranno ridondanti e andranno
rimossi. Altri si riveleranno mal posizionati e andranno spostati. Il
responsabile deve resistere alla tentazione di procedere a queste
correzioni immediatamente: vanno annotate e affrontate nelle fasi
successive, con la disciplina dello strangler pattern.

Capitolo VI --- Fase 4: Classificazione del Sistema
===================================================

Non tutto il codice va salvato. Non tutto il codice va eliminato. La
classificazione permette di distinguere con chiarezza ciò che è
recuperabile da ciò che non lo è, evitando sia l\'eccesso di
conservazione sia l\'eccesso di distruzione.

6.1 Il sistema a tre colori
---------------------------

Ogni modulo viene classificato in una delle tre categorie seguenti. La
categoria verde indica moduli stabili, testabili, privi di dipendenze
problematiche, riutilizzabili senza modifiche. La categoria gialla
indica moduli che funzionano ma che presentano debito tecnico: naming
confuso, logica ripetuta, assenza di test. La categoria rossa indica
moduli instabili, pericolosi, o così intrecciati con altri da non poter
essere corretti in isolamento.

6.2 Criteri di classificazione
------------------------------

I criteri per l\'assegnazione del colore sono quattro: capacità del
modulo di essere testato in isolamento, presenza di dipendenze circolari
o ambigue, chiarezza e coerenza della logica interna, rischio di
regressione causato da modifiche al modulo. Un modulo è verde solo se
supera tutti e quattro i criteri. È giallo se fallisce uno o due. È
rosso se ne fallisce tre o quattro.

6.3 Azioni derivate
-------------------

Al verde corrisponde l\'azione mantenere. Al giallo corrisponde
l\'azione ripulire. Al rosso corrisponde l\'azione sostituire
progressivamente attraverso lo strangler pattern. La classificazione
produce una tabella finale che diventa il piano operativo di tutte le
fasi successive. Nessun intervento deve essere eseguito su moduli non
classificati.

Capitolo VII --- Fase 5: Guardrails
===================================

I guardrails sono i meccanismi che impediscono al sistema di peggiorare
durante il lavoro di recupero. Senza guardrails, ogni correzione rischia
di introdurre una regressione invisibile. Con i guardrails, le
regressioni diventano visibili prima che raggiungano la produzione.

7.1 Test minimi sui flussi critici
----------------------------------

Per ogni flusso critico identificato nella Fase 2, si scrive almeno un
test end-to-end che verifica il percorso felice e almeno un test che
verifica il percorso di errore principale. Questi test non devono essere
esaustivi. Devono essere rappresentativi. Il loro scopo è avvisare
immediatamente quando un intervento rompe un flusso prima funzionante.

7.2 Validazione degli input
---------------------------

Ogni punto di ingresso del sistema, che sia un endpoint API o un form
dell\'interfaccia, deve validare gli input con uno schema esplicito. La
validazione deve essere dichiarativa, centralizzata e verificata
automaticamente. Ogni input non validato è un bug in attesa di
manifestarsi.

7.3 Gestione degli errori standardizzata
----------------------------------------

Tutti i moduli devono aderire a una convenzione unica per la gestione
degli errori. Gli errori prevedibili sono rappresentati come valori
tipizzati e trattati esplicitamente. Gli errori imprevedibili sono
catturati da un singolo livello di gestione globale. Mescolare i due
approcci produce codice impossibile da debuggare.

Capitolo VIII --- Fase 6: Debugging Sistematico
===============================================

Il debugging sistematico è un processo disciplinato di identificazione,
riproduzione e correzione dei difetti. Non è intuizione. Non è tentativo
ed errore. È un metodo.

8.1 Classificazione dei bug
---------------------------

I bug che si trovano in un software costruito con AI appartengono quasi
sempre a una di cinque categorie ricorrenti. I mismatch di dati si
verificano quando due livelli del sistema si aspettano forme diverse
dello stesso oggetto. Le race condition si verificano quando operazioni
asincrone interagiscono in ordini non previsti. Gli stati inconsistenti
si verificano quando la stessa informazione è rappresentata in punti
diversi che si disallineano. Gli errori silenziosi si verificano quando
un\'eccezione viene catturata e ignorata. Le duplicazioni logiche si
verificano quando la stessa regola è implementata in più luoghi con
piccole differenze.

8.2 Il protocollo di indagine
-----------------------------

Per ogni bug identificato, il responsabile segue un protocollo rigido.
Primo passo: riprodurre il bug in modo deterministico. Un bug non
riproducibile non può essere corretto. Secondo passo: isolare la
componente minima sufficiente a riprodurlo. Terzo passo: scrivere un
test che fallisce a causa del bug. Quarto passo: correggere il codice
finché il test passa. Quinto passo: verificare che il test continui a
passare dopo la correzione e che nessun altro test precedentemente verde
sia diventato rosso.

8.3 La disciplina del singolo cambiamento
-----------------------------------------

Durante il debugging non si apportano mai due modifiche
contemporaneamente. Anche quando si è certi che entrambe siano
necessarie, si applicano in sequenza, verificando dopo ciascuna. La
tentazione di accorpare modifiche multiple è forte, ma produce
invariabilmente la perdita del controllo causale: se qualcosa va storto,
non si sa più quale modifica lo ha causato.

Capitolo IX --- Fase 7: Recupero Verticale
==========================================

Il recupero verticale è l\'atto di riportare a uno stato stabile un
intero flusso utente, dal punto di ingresso fino al punto di uscita,
prima di passare al flusso successivo. È il contrario del recupero
orizzontale, che consiste nel correggere tutto un livello del sistema
prima di passare al successivo.

9.1 Perché verticale e non orizzontale
--------------------------------------

Il recupero orizzontale sembra più ordinato, ma produce un risultato
perverso: al termine di ogni livello corretto, nessun flusso utente
funziona meglio di prima, perché tutti i flussi dipendono da tutti i
livelli. Il valore si manifesta solo alla fine, se tutto va bene, cosa
che non accade mai. Il recupero verticale, al contrario, produce valore
a ogni iterazione: al termine di ogni ciclo, un flusso concreto è
pienamente funzionante e utilizzabile dagli utenti.

9.2 Il ciclo di recupero verticale
----------------------------------

Si sceglie un flusso, preferibilmente tra i meno complessi e tra i più
critici. Si isola il codice coinvolto. Si corregge la logica, separando
chiaramente interfaccia, stato, dominio e dati. Si scrivono i test. Si
verifica end-to-end. Si documenta il flusso corretto. Si passa al flusso
successivo. Il ciclo dura da uno a cinque giorni per flusso, a seconda
della complessità.

9.3 Ordine dei flussi
---------------------

L\'ordine con cui affrontare i flussi non è arbitrario. Si comincia dai
flussi di autenticazione, perché tutti gli altri vi dipendono. Si
prosegue con i flussi di lettura, più semplici di quelli di scrittura.
Si affrontano poi i flussi di scrittura semplici, e infine i flussi
complessi che coinvolgono transazioni, asincronicità, o interazioni con
sistemi esterni.

Capitolo X --- Fase 8: Strangler Pattern
========================================

Il termine, coniato da Martin Fowler, si riferisce a un albero
rampicante che cresce intorno a un albero preesistente fino a
sostituirlo. Applicato al software, descrive una strategia in cui un
sistema nuovo cresce intorno al sistema vecchio, sostituendolo
progressivamente senza mai interromperne il funzionamento.

10.1 Perché non riscrivere
--------------------------

La riscrittura totale è la soluzione apparentemente più semplice e la
più costosa. Richiede di ricostruire da zero tutta la conoscenza
implicita nei bug risolti nel tempo, di mantenere due sistemi in
parallelo per mesi, di pianificare un big bang di migrazione che
immancabilmente rivela problemi imprevisti. Lo strangler pattern elimina
tutti questi rischi sostituendo un modulo alla volta.

10.2 Il meccanismo del wrapper
------------------------------

Lo strangler pattern si implementa introducendo un wrapper, uno strato
sottile che intercetta le chiamate dirette al modulo vecchio e le
dirige, progressivamente, verso il modulo nuovo. All\'inizio tutte le
chiamate vanno al vecchio. Poi una percentuale crescente viene dirottata
al nuovo. Infine tutte le chiamate vanno al nuovo e il vecchio può
essere rimosso.

10.3 Controllo del rollout
--------------------------

Il dirottamento del traffico non avviene mai tutto in una volta. Si
procede con feature flag che permettono di attivare il modulo nuovo per
un sottoinsieme di utenti, osservarne il comportamento, confrontarlo con
il vecchio, e procedere solo se i risultati sono equivalenti. In caso di
problemi, il rollback è immediato e non richiede un deploy.

Capitolo XI --- Fase 9: Standardizzazione
=========================================

La standardizzazione è l\'assicurazione contro la ricaduta nel caos. Un
sistema recuperato ma privo di standard tornerà caotico nel giro di
pochi mesi, perché ogni sviluppatore, umano o artificiale, continuerà a
prendere decisioni locali ottimali che produrranno un nuovo insieme
globale disordinato.

11.1 Il documento degli standard
--------------------------------

Il documento degli standard definisce: le convenzioni di naming per
file, cartelle, variabili, funzioni, classi e tipi; la struttura delle
cartelle e i criteri per decidere dove un nuovo file deve essere
collocato; il pattern di gestione dello stato e le regole per la sua
propagazione; i pattern di definizione delle API, con particolare
attenzione a versionamento, paginazione, gestione degli errori; la
libreria dei componenti dell\'interfaccia e le regole per la creazione
di nuovi componenti; le convenzioni per i commit, le pull request e i
branch.

11.2 Standard come contratto
----------------------------

Gli standard non sono raccomandazioni. Sono contratti verificabili
automaticamente. Ogni standard deve avere un meccanismo di enforcement:
un linter, un hook di commit, un controllo di CI. Uno standard non
automatizzabile viene sistematicamente violato, a prescindere dalla
buona volontà del team.

11.3 Standard per l\'uso dell\'AI
---------------------------------

Il documento degli standard deve includere una sezione dedicata all\'uso
dell\'intelligenza artificiale. Deve definire quali compiti sono
delegabili all\'AI e quali no, quale formato devono avere i prompt,
quali verifiche devono essere eseguite sul codice generato prima del
commit, e come documentare le porzioni di codice prodotte con assistenza
AI. Senza questa sezione, il caos rientrerà dalla finestra.

Capitolo XII --- Fase 10: Hardening Finale
==========================================

L\'hardening è la fase in cui il sistema, ormai stabile, viene portato
al livello di affidabilità enterprise. Non è una fase di correzione: è
una fase di consolidamento. Presuppone che tutti i difetti strutturali
siano stati risolti.

12.1 Verifica di performance
----------------------------

Ogni flusso critico viene sottoposto a misurazione di performance. I
tempi di risposta, il consumo di memoria, il carico sul database vengono
registrati in condizioni rappresentative. I risultati vengono
confrontati con soglie accettabili. Ogni deviazione viene investigata e
corretta.

12.2 Verifica di sicurezza
--------------------------

Il sistema viene sottoposto a un audit di sicurezza che comprende:
verifica dei meccanismi di autenticazione, verifica delle regole di
autorizzazione su ogni endpoint, verifica della sanitizzazione di tutti
gli input, verifica della cifratura dei dati sensibili in transito e a
riposo, verifica della gestione dei segreti, verifica della
configurazione degli header HTTP di sicurezza, verifica delle dipendenze
esterne per vulnerabilità note.

12.3 Verifica degli edge case
-----------------------------

Ogni flusso viene testato con input degenerati: valori nulli, stringhe
vuote, stringhe di lunghezza massima, numeri negativi, numeri molto
grandi, date invalide, caratteri unicode speciali, payload malformati.
Gli edge case sono i bug che l\'AI non trova e che gli utenti trovano
sempre.

12.4 Test di carico
-------------------

Il sistema viene sottoposto a un test di carico che simula un volume di
utenti superiore al massimo previsto. Il test misura non solo le
performance, ma anche la resilienza ai picchi, la capacità di recupero
dopo un degrado, e l\'efficacia dei meccanismi di auto-scaling.

12.5 Pulizia del codice morto
-----------------------------

Ogni file, ogni funzione, ogni endpoint non più utilizzati vengono
rimossi. Il codice morto è una forma di rumore cognitivo che rende più
difficile il lavoro futuro. Rimuoverlo non ha conseguenze funzionali e
ha enormi conseguenze sulla manutenibilità.

Capitolo XIII --- Epilogo: Criteri di Uscita dal Protocollo
===========================================================

Il protocollo di recupero si considera completato quando, e solo quando,
sono soddisfatti contemporaneamente sei criteri oggettivi. Il primo
criterio è la comprensibilità: un nuovo sviluppatore, umano o
artificiale, deve poter ricostruire il funzionamento del sistema in meno
di una giornata di studio. Il secondo è la stabilità: il sistema non
deve presentare errori non gestiti in produzione per almeno trenta
giorni consecutivi. Il terzo è la testabilità: ogni modulo deve avere
una copertura di test sufficiente a rilevare regressioni significative.
Il quarto è l\'estendibilità: l\'introduzione di una nuova funzionalità
deve poter avvenire senza modificare moduli non direttamente
interessati. Il quinto è la controllabilità: ogni stato del sistema deve
essere osservabile dall\'esterno attraverso log, metriche o dashboard.
Il sesto è la documentazione: la documentazione tecnica deve essere
allineata con il codice e aggiornata automaticamente.

Un sistema che soddisfa questi sei criteri è un sistema che può essere
affidato a un team qualunque e che può crescere senza degradare. Un
sistema che soddisfa cinque criteri su sei è un sistema ancora in fase
di recupero. Non esistono sconti.

> Il software perfetto non esiste. Il software controllabile sì, e per
> un\'azienda enterprise è sufficiente.

Postfazione: Una nota sulla pazienza
------------------------------------

Il protocollo descritto in questo libro richiede tempo. Un sistema di
media complessità, costruito con AI per sei mesi, richiede tipicamente
da sei a dodici settimane di recupero rigoroso. Un sistema di grande
complessità può richiedere sei mesi. Questi tempi sembrano lunghi
rispetto alla velocità di costruzione iniziale, ma sono brevi rispetto
al costo di non fare nulla. Un software instabile costa, ogni mese, più
di quanto il recupero costi una tantum. La matematica del debito tecnico
è spietata: gli interessi compongono.

Il lettore che arriva in fondo a questo volume è pronto per il secondo:
la costruzione, da zero, di un software enterprise progettato per essere
stabile fin dall\'inizio. Il metodo di costruzione presuppone la
disciplina acquisita con il metodo di recupero. Costruire bene è più
facile che recuperare, a condizione di aver imparato cosa significa
recuperare.

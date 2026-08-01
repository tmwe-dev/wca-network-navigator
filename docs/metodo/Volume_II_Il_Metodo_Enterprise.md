*Manuale operativo per la progettazione e lo sviluppo di prodotti
scalabili e vendibili*

Volume II --- Serie Enterprise Software Engineering

Prefazione
==========

Il primo volume di questa serie insegna a riparare ciò che è rotto. Il
secondo insegna a non romperlo mai. Chi ha attraversato un recupero sa
che il costo del disordine iniziale non è pagato dagli autori del
disordine, ma da chi viene dopo di loro. Questo libro è scritto per chi
vuole costruire, fin dal primo giorno, un software che non richieda mai
di essere recuperato.

Il principio fondamentale che governa tutto il metodo è semplice da
enunciare e difficile da applicare: l\'intelligenza artificiale accelera
la costruzione, ma non sostituisce l\'architettura. L\'AI è uno
strumento di velocità, non di direzione. La direzione è responsabilità
umana e deve essere stabilita prima che l\'AI venga interpellata.

Un software enterprise non è un software complicato. È un software
prevedibile. Un utente che lo usa ottiene sempre lo stesso risultato
dallo stesso input. Uno sviluppatore che lo modifica prevede le
conseguenze delle sue modifiche. Un operatore che lo gestisce sa sempre
in quale stato si trovi. Un imprenditore che lo vende può promettere
cose che sa di poter mantenere. La prevedibilità, non la sofisticazione,
è la qualità distintiva del software enterprise.

> La perfezione in un software non è assenza di difetti. È presenza di
> controllo.

Capitolo I --- Fase Zero: Validazione Prima della Costruzione
=============================================================

L\'errore più costoso che si possa commettere è costruire perfettamente
la cosa sbagliata. Prima che una sola riga di codice venga scritta, il
problema deve essere validato. La validazione non è un esercizio di
marketing: è una necessità ingegneristica. Un problema reale produce
vincoli chiari, e i vincoli chiari producono architetture semplici. Un
problema immaginato produce requisiti vaghi, e i requisiti vaghi
producono architetture barocche.

1.1 Il problema reale
---------------------

Un problema reale ha quattro caratteristiche verificabili. Primo,
esistono persone che lo vivono. Secondo, queste persone possono
descriverlo con precisione. Terzo, queste persone stanno già cercando di
risolverlo, anche male. Quarto, queste persone sono disposte a pagare
per una soluzione migliore. Un problema che non soddisfa tutti e quattro
i criteri non è un problema: è un\'ipotesi. Costruire software su
ipotesi non validate è l\'origine della maggior parte dei fallimenti di
prodotto.

1.2 Il profilo dell\'utente tipo
--------------------------------

L\'utente tipo non è un segmento di mercato. È una persona concreta, con
un nome, una professione, un contesto d\'uso, una competenza tecnica, un
budget, un\'urgenza. Il metodo richiede di identificare almeno cinque
persone reali che corrispondono al profilo e di intervistarle
individualmente. Se non se ne trovano cinque, il profilo è troppo
stretto o inesistente.

1.3 La disponibilità a pagare
-----------------------------

La domanda finale di ogni validazione è: quanto è disposto a pagare? Una
risposta vaga indica assenza di problema reale. Una risposta precisa
indica presenza di problema reale. Un impegno formale, anche piccolo,
indica presenza di problema urgente. Senza questo livello di
concretezza, la costruzione del software è una scommessa cieca.

Capitolo II --- Fase Uno: Definizione del Sistema
=================================================

La definizione del sistema è il documento fondativo di tutto il
progetto. Viene scritto prima dell\'architettura, prima del codice,
prima dei prototipi. Il suo scopo è rendere esplicito cosa il sistema
deve fare e, altrettanto importante, cosa non deve fare.

2.1 Visione del prodotto
------------------------

La visione del prodotto è una singola frase che descrive cosa il
software fa e per chi. Deve essere specifica, verificabile e
memorizzabile. Una visione efficace è un criterio di decisione: quando
un membro del team deve scegliere tra due opzioni, la visione stabilisce
quale sia preferibile. Una visione vaga, del tipo una piattaforma
completa per la gestione aziendale, non è una visione: è l\'assenza di
visione.

2.2 Casi d\'uso reali
---------------------

I casi d\'uso sono descrizioni concrete di situazioni in cui il software
viene utilizzato. Ogni caso d\'uso identifica un attore, un\'intenzione,
un contesto, una sequenza di azioni, un risultato atteso. Un caso d\'uso
ben scritto è scrivibile, leggibile e interpretabile senza ambiguità. Un
caso d\'uso mal scritto genera implementazioni divergenti che si
manifesteranno come bug mesi dopo.

2.3 Flussi utente
-----------------

Ogni caso d\'uso si traduce in un flusso utente, ossia nella sequenza di
schermate, interazioni e transizioni che l\'utente attraversa per
completarlo. Il flusso deve essere disegnato prima della progettazione
dell\'interfaccia. Un flusso ben definito vincola la progettazione a
soluzioni semplici. Un flusso assente produce interfacce in cui ogni
schermata è progettata in isolamento e la cui somma è incoerente.

2.4 Modello dati
----------------

Il modello dati è la rappresentazione formale delle entità del dominio e
delle loro relazioni. Deve essere definito prima del codice perché, in
qualunque software, il modello dati è la struttura più stabile: ciò che
cambia facilmente è l\'interfaccia; ciò che cambia difficilmente è il
modello dati. Un modello dati ben pensato può sopravvivere a tre
riscritture del codice; un modello dati improvvisato obbliga a
riscrivere tutto ogni volta che il problema evolve.

2.5 Regole di dominio
---------------------

Le regole di dominio sono i vincoli che governano i dati e le
operazioni. Esempi: un ordine non può essere spedito prima di essere
pagato; un utente non può modificare i dati di un altro utente; un
pagamento non può essere cancellato dopo la fatturazione. Queste regole
devono essere raccolte esaustivamente prima dell\'architettura, perché
sono le regole a determinare quali transazioni siano necessarie, quali
vincoli debbano essere applicati, quali eventi debbano essere generati.

2.6 Ruoli e permessi
--------------------

La definizione dei ruoli stabilisce chi può fare cosa. È una parte del
modello di dominio, non un dettaglio tecnico. I ruoli definiti a
posteriori producono sempre sistemi in cui le autorizzazioni sono un
insieme di patch ad hoc, impossibili da verificare. I ruoli definiti a
priori producono sistemi in cui le autorizzazioni sono una conseguenza
naturale del modello.

Capitolo III --- Fase Due: Architettura
=======================================

L\'architettura è l\'insieme delle decisioni strutturali che determinano
come il sistema è costruito. Sono le decisioni più difficili da cambiare
una volta prese, e per questo devono essere prese con la massima
consapevolezza. Un\'architettura ben pensata è invisibile: chi lavora al
suo interno non la percepisce come un vincolo. Un\'architettura mal
pensata è un ostacolo quotidiano.

3.1 I moduli del sistema
------------------------

Il sistema viene decomposto in moduli. Un modulo è un insieme coeso di
funzionalità che condividono uno stesso scopo. I moduli si organizzano
intorno al dominio, non intorno alle tecnologie: un modulo ordini è
migliore di un modulo controllers. La decomposizione modulare corretta è
riconoscibile da un criterio semplice: modificare un modulo deve
richiedere di toccare solo quel modulo.

3.2 Contratti tra moduli
------------------------

Ogni modulo espone un contratto esplicito verso gli altri moduli. Il
contratto definisce quali operazioni sono disponibili, quali input
ricevono, quali output restituiscono, quali errori possono produrre,
quali effetti collaterali generano. I moduli comunicano solo attraverso
i contratti, mai attraverso l\'accesso diretto ai loro interni. Questa
regola, se rispettata fin dall\'inizio, rende il sistema ricombinabile;
se violata, rende il sistema un blocco monolitico impossibile da
evolvere.

3.3 Database e persistenza
--------------------------

La scelta del database è una delle decisioni architetturali più
difficili da revocare. Un database relazionale è la scelta predefinita
corretta per la grande maggioranza dei sistemi enterprise. Le
alternative, database documentali, graph database, key-value store, sono
giustificate solo da requisiti specifici misurabili. La regola è: scegli
il database relazionale, salvo prova contraria.

3.4 Eventi e asincronicità
--------------------------

I sistemi enterprise quasi sempre richiedono elaborazioni asincrone:
invio di email, generazione di report, sincronizzazione con sistemi
esterni, notifiche. L\'architettura deve prevedere un meccanismo di
gestione degli eventi fin dall\'inizio: una coda di messaggi, un event
bus, o un sistema equivalente. Introdurre l\'asincronia a posteriori
richiede sempre di riscrivere porzioni consistenti del codice.

3.5 Sicurezza by design
-----------------------

La sicurezza non è una fase finale. È un requisito architetturale.
Autenticazione, autorizzazione, cifratura, gestione dei segreti,
sanitizzazione degli input devono essere definiti prima del primo
commit. Un sistema sicuro per costruzione è molto più economico di un
sistema reso sicuro a posteriori. L\'ordine non è negoziabile.

Capitolo IV --- Fase Tre: Fondazioni
====================================

Le fondazioni sono la parte del sistema che viene costruita prima di
qualunque funzionalità di prodotto. Sono invisibili all\'utente finale,
ma sono ciò che rende possibile tutto il resto. Fondazioni solide
permettono di costruire velocemente. Fondazioni deboli costringono a
lavorare il doppio per ogni feature successiva.

4.1 Routing e struttura dell\'applicazione
------------------------------------------

La struttura di routing definisce come le richieste vengono instradate
verso le funzionalità. Deve essere coerente, prevedibile e
auto-documentante. Ogni endpoint deve rispettare una convenzione di
naming chiara. La struttura delle cartelle del codice deve rispecchiare
la struttura del routing, in modo che uno sviluppatore possa localizzare
qualunque funzionalità partendo dall\'URL che la invoca.

4.2 Autenticazione e gestione sessione
--------------------------------------

L\'autenticazione è il primo modulo da costruire, prima di qualunque
altro. Una volta scelta la strategia, JWT, sessioni tradizionali, token
firmati, essa non va più cambiata per l\'intera vita del sistema. La
gestione della sessione deve prevedere scadenza, rinnovo, revoca, logout
su tutti i dispositivi, e protezione contro gli attacchi più comuni.

4.3 Design system
-----------------

Il design system è una libreria di componenti dell\'interfaccia definita
prima che qualunque schermata venga progettata. Deve contenere tutti gli
elementi fondamentali: tipografia, colori, bottoni, form, tabelle,
modali, notifiche, navigazione. Ogni schermata successiva viene composta
utilizzando solo componenti del design system. Questa regola,
apparentemente restrittiva, è ciò che garantisce la coerenza visiva
dell\'intero prodotto.

4.4 Gestione degli errori
-------------------------

La gestione degli errori è una scelta architetturale che attraversa
tutto il sistema. Ogni errore possibile deve essere classificato in una
delle tre categorie: errore dell\'utente, errore del sistema, errore
imprevisto. A ciascuna categoria corrisponde un trattamento standard:
l\'errore dell\'utente viene mostrato con un messaggio chiaro; l\'errore
del sistema viene loggato, riportato e presentato all\'utente con un
messaggio generico; l\'errore imprevisto viene catturato dal global
error handler e notificato al team.

4.5 Logging e osservabilità
---------------------------

Ogni operazione significativa del sistema deve produrre un record nel
log. Il log deve essere strutturato, correlabile, e inviato a un sistema
centralizzato. Accanto al log si affiancano le metriche, numeri
aggregati che descrivono il comportamento del sistema nel tempo, e il
tracing, la capacità di seguire una singola richiesta attraverso tutti i
moduli che la elaborano. Questi tre strumenti costituiscono il trittico
dell\'osservabilità.

4.6 Framework di test
---------------------

Il framework di test viene installato e configurato prima che venga
scritto il codice di produzione. I test unitari, i test di integrazione
e i test end-to-end devono avere una struttura chiara e un meccanismo di
esecuzione automatica sulla CI. La regola è che nessun codice entra in
produzione senza test corrispondenti. La regola non è negoziabile.

4.7 CI/CD e ambienti
--------------------

Tre ambienti sono necessari fin dal primo giorno: sviluppo, staging,
produzione. I tre ambienti devono essere configurabili in modo identico,
distinguibili solo attraverso variabili d\'ambiente. La pipeline di
CI/CD deve eseguire automaticamente linting, test, build, deploy. Il
deploy in produzione deve essere irreversibile solo formalmente,
tecnicamente deve essere sempre possibile un rollback immediato.

Capitolo V --- Fase Quattro: Contratti API
==========================================

I contratti API sono la colonna vertebrale di ogni sistema composto da
più componenti. Definiscono come client e server comunicano, quali dati
vengono scambiati, quali errori possono verificarsi. Un contratto ben
definito è un documento eseguibile: può essere usato per generare
client, per validare risposte, per simulare il comportamento del server
in test.

5.1 Specifica formale
---------------------

Ogni API viene specificata in modo formale, tipicamente con OpenAPI o
con un sistema equivalente. La specifica include, per ogni endpoint, il
metodo HTTP, il percorso, i parametri di query, il formato del corpo, il
formato della risposta, i codici di errore possibili, e una descrizione
semantica dell\'operazione. La specifica è mantenuta insieme al codice e
viene aggiornata a ogni modifica.

5.2 Versionamento
-----------------

Le API cambiano nel tempo. Il versionamento è la strategia che permette
di farle cambiare senza rompere i client esistenti. La versione viene
espressa nell\'URL o in un header. Le modifiche che rompono la
compatibilità richiedono una nuova versione. Le modifiche
retrocompatibili, come l\'aggiunta di campi opzionali, possono essere
applicate alla versione esistente. Il mancato versionamento è una delle
cause più frequenti dei sistemi impossibili da evolvere.

5.3 Gestione degli errori nelle API
-----------------------------------

Ogni risposta di errore deve avere una struttura standard: un codice
HTTP appropriato, un codice di errore applicativo, un messaggio
leggibile, eventuali dettagli strutturati. Il client non deve mai dover
analizzare stringhe per capire cosa sia successo: deve poter agire in
base al codice di errore. La standardizzazione delle risposte di errore
è ciò che rende possibile scrivere client robusti.

Capitolo VI --- Fase Cinque: Sviluppo Modulare
==============================================

Con le fondazioni in piedi e i contratti definiti, inizia lo sviluppo
delle funzionalità di prodotto. La regola fondamentale è: un modulo alla
volta. Costruire più moduli in parallelo sembra efficiente, ma produce
interferenze, inconsistenze e debito tecnico. Costruirne uno alla volta
sembra lento, ma è, alla prova dei fatti, la strategia più veloce.

6.1 Il ciclo del modulo
-----------------------

Ogni modulo viene costruito seguendo lo stesso ciclo in cinque passi.
Primo, si definisce il modello dati del modulo, ossia le entità che
persisteranno nel database. Secondo, si implementa la logica di dominio,
ossia le regole che governano le operazioni sul modulo. Terzo, si
aggiungono le validazioni, tanto lato server quanto lato client. Quarto,
si costruisce l\'interfaccia utente utilizzando solo componenti del
design system. Quinto, si scrivono i test che coprono i casi principali
e gli errori prevedibili.

6.2 Ordine dei moduli
---------------------

L\'ordine con cui costruire i moduli non è arbitrario. Si comincia dai
moduli di fondazione del dominio, quelli da cui tutti gli altri
dipendono: autenticazione, gestione utenti, gestione
dell\'organizzazione. Si prosegue con i moduli di lettura, più semplici
da validare. Si affrontano poi i moduli di scrittura, e infine i moduli
complessi che coinvolgono più entità, transazioni o elaborazioni
asincrone.

6.3 Il principio della completezza
----------------------------------

Un modulo è considerato completo solo quando è completo in tutte le sue
dimensioni: dati, logica, validazione, interfaccia, test,
documentazione. Un modulo parzialmente completo è un debito tecnico
camuffato. La tentazione di passare al modulo successivo prima di aver
completato il precedente è forte, perché il modulo successivo è sempre
più interessante. La disciplina impone di completare prima di avanzare.

Capitolo VII --- Fase Sei: L\'Uso Corretto dell\'Intelligenza Artificiale
=========================================================================

L\'intelligenza artificiale è lo strumento più potente mai messo a
disposizione di uno sviluppatore. È anche uno strumento che, usato male,
produce sistemi irrecuperabili. Questo capitolo definisce le regole
d\'uso che distinguono l\'uso corretto da quello distruttivo.

7.1 Cosa l\'AI deve fare
------------------------

L\'AI è eccellente nel produrre codice boilerplate, cioè codice
ripetitivo che segue pattern noti. È eccellente nel generare componenti
dell\'interfaccia a partire da specifiche chiare. È eccellente nel
proporre refactor locali, limitati a una singola funzione o a un singolo
file. È eccellente nello scrivere test per codice esistente. È
eccellente nel generare documentazione a partire dal codice. In tutti
questi casi l\'AI aumenta la produttività senza introdurre rischi.

7.2 Cosa l\'AI non deve fare
----------------------------

L\'AI non deve inventare l\'architettura. Non possiede la visione
d\'insieme del sistema, e le sue proposte architetturali sono quasi
sempre localmente ragionevoli e globalmente incoerenti. L\'AI non deve
gestire le logiche critiche di dominio, quelle che, se implementate
male, producono perdite economiche o problemi di sicurezza. L\'AI non
deve modificare simultaneamente più moduli: ogni intervento cross-modulo
va revisionato manualmente, pezzo per pezzo.

7.3 La regola del singolo obiettivo
-----------------------------------

Ogni interazione con l\'AI deve avere un singolo obiettivo verificabile.
Un prompt che chiede di modificare tre cose contemporaneamente produrrà
un risultato che le modifica tutte e tre in modo approssimativo. Un
prompt che ne chiede una, con contesto preciso, produrrà un risultato
accettabile. La lentezza apparente di interazioni più piccole è
compensata dalla velocità reale di risultati utilizzabili.

7.4 Il contesto minimo necessario
---------------------------------

Ogni prompt efficace include quattro elementi: il file o i file
coinvolti, il contratto di input e output atteso, i vincoli da non
violare, il criterio di verifica del successo. Senza questi elementi,
l\'AI procede per inferenza e produce codice che sembra corretto ma
viola assunzioni che il prompt non ha esplicitato.

7.5 La revisione obbligatoria
-----------------------------

Nessun codice prodotto dall\'AI entra nel sistema senza una revisione
umana. La revisione non è una formalità: è il momento in cui uno
sviluppatore competente verifica che il codice rispetti l\'architettura,
aderisca agli standard, sia coerente con il resto del sistema, e non
introduca regressioni. Senza revisione, l\'AI è una fonte di debito
tecnico accelerato.

Capitolo VIII --- Fase Sette: Controllo Qualità
===============================================

Il controllo qualità non è un\'attività separata dallo sviluppo. È una
proprietà del processo di sviluppo. Se il processo è giusto, la qualità
è una conseguenza. Se il processo è sbagliato, nessuna attività di
controllo qualità aggiunta a posteriori può compensare la deriva.

8.1 La checklist della feature completa
---------------------------------------

Ogni feature, prima di essere considerata completa, deve soddisfare otto
criteri verificabili. Deve avere test che coprano il percorso felice e i
principali percorsi di errore. Deve gestire esplicitamente tutti gli
errori prevedibili. Deve validare tutti gli input, tanto sul client
quanto sul server. Deve mostrare stati di caricamento per operazioni non
istantanee. Deve gestire lo stato di errore con un messaggio
comprensibile. Deve essere coerente con il design system. Deve essere
accessibile secondo gli standard di accessibilità. Deve essere
documentata, almeno al livello del suo contratto pubblico.

8.2 Code review
---------------

La code review è l\'ultimo filtro prima del merge nel branch principale.
Non è un rito burocratico: è un atto tecnico di responsabilità
condivisa. Chi revisiona una pull request diventa co-responsabile del
codice. Una revisione superficiale, del tipo approvazione senza lettura,
è peggio dell\'assenza di revisione, perché crea l\'illusione della
qualità.

8.3 Test automatici sulla CI
----------------------------

Nessuna pull request può essere fusa nel branch principale se i test
automatici non passano. Non esistono eccezioni. Non esistono test rotti
tollerati. Un test rotto viene riparato immediatamente o cancellato;
lasciarlo rotto è il primo passo verso l\'erosione dell\'intero sistema
di test.

Capitolo IX --- Fase Otto: Iterazione Controllata
=================================================

Un prodotto enterprise non nasce finito. Nasce in forma minima e cresce
attraverso iterazioni controllate. Il controllo dell\'iterazione è ciò
che distingue la crescita ordinata dal caos evolutivo.

9.1 Il ciclo dell\'iterazione
-----------------------------

Ogni iterazione segue un ciclo in quattro fasi. Si costruisce una
piccola porzione di funzionalità. Si testa in modo esaustivo, sia
automaticamente sia manualmente. Si rilascia agli utenti reali,
inizialmente a un sottoinsieme ristretto attraverso feature flag. Si
misura il comportamento effettivo, confrontandolo con le aspettative.
Ogni ciclo termina con una decisione esplicita: consolidare, iterare, o
arretrare.

9.2 Feature flag
----------------

Le feature flag sono il meccanismo che permette di rilasciare codice in
produzione senza attivarlo per tutti gli utenti. Sono uno strumento
essenziale dell\'iterazione controllata. Senza feature flag, ogni
rilascio è una scommessa ad alto rischio. Con feature flag, ogni
rilascio è un esperimento controllato con possibilità di rollback
immediato.

9.3 Metriche di successo
------------------------

Ogni feature rilasciata deve avere metriche di successo definite in
anticipo. Una metrica di successo ex post è una razionalizzazione, non
una misura. Le metriche devono essere osservabili, quantificabili e
confrontabili nel tempo. Se i numeri non corrispondono alle aspettative,
la feature va rivista, non giustificata.

Capitolo X --- Fase Nove: Scalabilità
=====================================

La scalabilità è la proprietà di un sistema di mantenere le proprie
performance all\'aumentare del carico. Non è una proprietà magica: è il
risultato di scelte architetturali precise, prese nei momenti giusti.
Scegliere la scalabilità troppo presto è sovrappensiero inutile.
Scegliere la scalabilità troppo tardi è ricostruzione forzata.

10.1 Caching strategico
-----------------------

Il caching è lo strumento più semplice e potente per migliorare le
performance. Va introdotto nei punti giusti: risposte HTTP
frequentemente lette e raramente scritte, risultati di query costose,
calcoli deterministici ripetuti. Il caching inappropriato, come quello
di dati che cambiano continuamente, introduce bug di consistenza
impossibili da diagnosticare.

10.2 Code splitting e lazy loading
----------------------------------

Il codice del client non deve essere servito tutto in un\'unica
richiesta. Deve essere diviso in blocchi caricati a richiesta. Questa
tecnica, chiamata code splitting, riduce drammaticamente il tempo di
caricamento iniziale. Si applica ai singoli moduli di funzionalità, in
modo che un utente paghi il costo di caricamento solo per le
funzionalità che utilizza.

10.3 Elaborazione asincrona
---------------------------

Ogni operazione che richiede più di pochi secondi deve essere eseguita
in modo asincrono, fuori dal ciclo di richiesta-risposta. L\'utente
riceve immediatamente un acknowledgment e viene notificato al
completamento. I sistemi che eseguono operazioni lunghe in modo sincrono
collassano sotto carico.

10.4 Scalabilità orizzontale
----------------------------

Il sistema deve essere progettato fin dall\'inizio per poter essere
eseguito su più istanze simultanee. Questo significa assenza di stato
nella memoria dei processi, uso di una sorgente centralizzata per
sessioni e cache condivise, idempotenza delle operazioni che possono
essere ritentate. Un sistema che non è scalabile orizzontalmente ha un
tetto di crescita che si raggiunge prima di quanto ci si aspetti.

Capitolo XI --- Fase Dieci: Sicurezza
=====================================

La sicurezza non è un capitolo finale. È un tema trasversale che
attraversa ogni fase del metodo. Questo capitolo raccoglie le regole
fondamentali che devono essere rispettate senza eccezioni. La violazione
di una qualunque di queste regole compromette l\'intera sicurezza del
sistema.

11.1 Autenticazione robusta
---------------------------

Le password, se usate, devono essere conservate solo come hash calcolati
con algoritmi progettati per la lentezza controllata, come bcrypt,
argon2 o scrypt. L\'autenticazione a due fattori deve essere disponibile
e, per ruoli sensibili, obbligatoria. I tentativi di autenticazione
devono essere limitati per prevenire attacchi a forza bruta. Le sessioni
devono scadere dopo un periodo di inattività ragionevole.

11.2 Autorizzazione granulare
-----------------------------

Ogni richiesta al backend deve verificare esplicitamente che l\'utente
che la effettua abbia il diritto di eseguirla. Questa verifica non deve
mai essere implicita o delegata al frontend. Il frontend nasconde
operazioni non disponibili per comodità dell\'utente; il backend le
rifiuta per garantire la sicurezza. La duplicazione del controllo è una
caratteristica, non uno spreco.

11.3 Sanitizzazione degli input
-------------------------------

Ogni input proveniente dall\'esterno deve essere sanitizzato prima di
essere utilizzato. Stringhe inserite nel database possono contenere SQL
injection. Stringhe inserite nell\'HTML possono contenere XSS. URL
utilizzati per redirect possono contenere open redirect. File caricati
dagli utenti possono contenere payload malevoli. Ogni categoria di input
ha una forma di sanitizzazione specifica, e nessuna deve essere omessa.

11.4 Gestione dei segreti
-------------------------

I segreti, come chiavi API, password di database, token di servizio, non
devono mai essere inclusi nel codice sorgente. Devono essere gestiti
attraverso un sistema di vault, iniettati nell\'applicazione come
variabili d\'ambiente al momento dell\'esecuzione, e ruotati
periodicamente. Un segreto committato in un repository, anche privato, è
un segreto compromesso.

11.5 Dipendenze e supply chain
------------------------------

Ogni dipendenza esterna è una superficie di attacco potenziale. Le
dipendenze devono essere selezionate con criterio, verificate
periodicamente contro database di vulnerabilità note, aggiornate
tempestivamente quando vengono rilasciate versioni che correggono
problemi di sicurezza. Un sistema con dipendenze obsolete è un sistema
vulnerabile.

Capitolo XII --- Fase Undici: Monitoring
========================================

Un sistema che non viene osservato è un sistema di cui si conosce solo
il comportamento dichiarato, non quello reale. Il monitoring trasforma
il sistema da scatola nera a scatola trasparente, permettendo di
rilevare problemi prima che diventino incidenti e di comprenderne le
cause quando si manifestano.

12.1 Log centralizzati
----------------------

I log di tutti i componenti del sistema devono essere raccolti in un
unico luogo, indicizzati, e ricercabili. La ricerca deve essere
possibile per qualunque campo strutturato: identificativo utente,
identificativo richiesta, codice di errore, intervallo temporale. Un log
confinato nei file locali dei server è un log inutilizzabile in caso di
incidente.

12.2 Error tracking
-------------------

Ogni errore non gestito che raggiunge l\'utente finale deve essere
automaticamente catturato, aggregato, e notificato al team di sviluppo.
Il sistema di error tracking deve associare agli errori informazioni di
contesto: versione del software, utente coinvolto, sequenza di azioni
che ha portato all\'errore, stato del sistema al momento del fallimento.
Senza queste informazioni, il debugging di un errore segnalato da un
utente è una questione di fortuna.

12.3 Metriche di performance
----------------------------

Le metriche di performance misurano il comportamento aggregato del
sistema nel tempo. Le metriche fondamentali sono: latenza delle
richieste, throughput, tasso di errori, consumo di risorse. Queste
metriche devono essere visualizzate in dashboard permanenti, e devono
generare allarmi quando superano soglie predefinite. La rilevazione
precoce di un degrado è la differenza tra un incidente gestito e un
disastro.

12.4 Business metrics
---------------------

Accanto alle metriche tecniche vanno affiancate metriche di business:
numero di utenti attivi, conversioni, revenue, retention. Queste
metriche non servono al team di sviluppo nel breve termine, ma sono
essenziali per comprendere se il prodotto sta raggiungendo i suoi
obiettivi e per prendere decisioni di priorità informate.

Capitolo XIII --- Fase Dodici: Hardening
========================================

L\'hardening è la fase in cui il sistema, ormai funzionalmente completo,
viene preparato al contatto con il mondo reale. Nel mondo reale gli
utenti fanno cose che nessun progettista ha previsto, le reti
falliscono, i server si bloccano, i dati arrivano in formati
inaspettati. L\'hardening è ciò che rende il sistema resistente a tutto
questo.

13.1 Test degli edge case
-------------------------

Ogni flusso viene sottoposto a test con input estremi. Stringhe vuote,
stringhe di lunghezza massima, caratteri unicode, numeri al limite dei
tipi, date passate e future, timezone diverse, connessioni lente,
connessioni interrotte, risposte duplicate. Gli edge case sono
prevedibili, ma solo se li si cerca attivamente. In produzione si
manifestano inevitabilmente.

13.2 Test di carico
-------------------

Il sistema viene sottoposto a un test di carico che riproduce il volume
atteso al picco, più un margine di sicurezza. Il test misura non solo le
performance, ma la resilienza: cosa succede quando il carico supera la
capacità, come il sistema si recupera al calo del carico, se i
meccanismi di auto-scaling rispondono correttamente.

13.3 Piano di rollback
----------------------

Ogni deploy in produzione deve avere un piano di rollback documentato e
testato. Il rollback non è una confessione di incompetenza: è
un\'assicurazione. Un sistema enterprise deve poter tornare alla
versione precedente in minuti, non in ore. La capacità di rollback deve
essere verificata periodicamente, non solo in caso di emergenza.

13.4 Disaster recovery
----------------------

Il piano di disaster recovery descrive come il sistema può essere
ripristinato in caso di perdita totale. Include: frequenza dei backup,
località di conservazione, procedura di ripristino, tempo massimo di
ripristino accettabile, punti di recupero massimi accettabili. Un piano
di disaster recovery mai testato è un documento inutile. Il test deve
essere eseguito almeno una volta prima del lancio e ripetuto
periodicamente.

Capitolo XIV --- Fase Tredici: Go to Market
===========================================

Il go to market è il momento in cui il sistema incontra gli utenti. Non
è la fine del progetto: è l\'inizio della sua vita reale. Un go to
market mal gestito può rovinare un prodotto tecnicamente eccellente. Un
go to market ben gestito amplifica il valore di un prodotto semplice.

14.1 Stabilità percepita
------------------------

Gli utenti non giudicano la qualità tecnica: giudicano la stabilità
percepita. Un sistema che funziona perfettamente ma mostra messaggi di
errore ambigui viene percepito come instabile. Un sistema con
limitazioni note ma comportamento prevedibile viene percepito come
affidabile. La stabilità percepita si costruisce con attenzione ai
messaggi, alle transizioni, agli stati di caricamento, alla coerenza
visiva.

14.2 Onboarding
---------------

L\'onboarding è il primo contatto dell\'utente con il prodotto. Deve
portarlo dal nulla al primo risultato di valore nel minor tempo
possibile. Un onboarding che richiede più di cinque minuti per produrre
il primo valore perde la maggior parte degli utenti. La progettazione
dell\'onboarding è una disciplina a sé stante e merita la stessa
attenzione della progettazione delle funzionalità principali.

14.3 Documentazione
-------------------

La documentazione rivolta agli utenti deve rispondere alle domande che
gli utenti si pongono, non alle domande che gli sviluppatori si
aspettano. Deve essere organizzata per compiti, non per funzionalità.
Deve essere ricercabile, aggiornata, e illustrata. Una documentazione
scarsa o obsoleta produce ticket di supporto che, sommati, costano più
della documentazione ben scritta.

14.4 Supporto
-------------

Il canale di supporto deve esistere dal primo giorno. Gli utenti del
primo periodo sono i più preziosi: sono coloro che hanno scommesso sul
prodotto prima che fosse provato. Ogni loro segnalazione è un dono. Il
supporto non è un costo da minimizzare, è un investimento da
massimizzare nei primi mesi.

Capitolo XV --- Lo Standard Enterprise
======================================

Un software enterprise, al termine del percorso descritto in questo
libro, si riconosce da cinque caratteristiche oggettive e misurabili.
Queste non sono aspirazioni: sono criteri di accettazione. Un prodotto
che non le soddisfa tutte non è enterprise, indipendentemente dalle
dichiarazioni commerciali.

15.1 Prevedibilità
------------------

Il sistema si comporta sempre nello stesso modo a parità di input e di
stato. Non esistono comportamenti occasionali, non esistono scenari che
funzionano a giorni alterni. La prevedibilità è la condizione necessaria
per poter promettere qualcosa agli utenti.

15.2 Stabilità
--------------

Il sistema tollera carichi, errori di rete, input malformati, utilizzi
inattesi senza degradarsi o corrompersi. Gli incidenti, quando si
verificano, hanno impatto limitato e recupero rapido. La stabilità è ciò
che permette agli utenti di dipendere dal sistema per il loro lavoro.

15.3 Leggibilità
----------------

Il codice del sistema può essere compreso da uno sviluppatore
qualificato in tempi ragionevoli. Le decisioni architetturali sono
documentate. Le convenzioni sono rispettate ovunque. La leggibilità è la
condizione necessaria per l\'evoluzione del sistema nel tempo.

15.4 Estendibilità
------------------

Nuove funzionalità possono essere aggiunte senza modificare parti non
direttamente interessate. I moduli sono sufficientemente indipendenti da
permettere sviluppi paralleli senza interferenze. L\'estendibilità è ciò
che permette al prodotto di crescere senza collassare.

15.5 Monitoraggio
-----------------

Ogni stato del sistema è osservabile dall\'esterno. Ogni problema
significativo viene rilevato prima che raggiunga gli utenti, o entro
minuti dal suo manifestarsi. Il monitoraggio è ciò che trasforma la
gestione del sistema da reattiva a proattiva.

Capitolo XVI --- Gli Errori da Evitare Assolutamente
====================================================

Questo capitolo raccoglie gli errori più frequenti osservati nei
progetti di sviluppo assistito da AI. Ciascuno di essi, se commesso,
compromette in modo grave il progetto. Sono presentati qui non come
consigli, ma come avvertimenti basati su casi reali.

16.1 Costruire l\'interfaccia prima della logica
------------------------------------------------

L\'errore più frequente e più costoso. Un\'interfaccia costruita prima
che la logica di dominio sia chiara finisce per modellare la logica a
sua immagine, invertendo la direzione corretta. La logica del dominio
deve esistere e funzionare prima che venga costruita l\'interfaccia che
la espone.

16.2 Affidare l\'architettura all\'AI
-------------------------------------

L\'AI produce architetture plausibili ma architetturalmente
superficiali. Un\'architettura delegata all\'AI è sempre
un\'architettura che richiederà di essere rifatta. Il tempo risparmiato
delegando viene perso, con interessi, ricostruendo.

16.3 Rimandare test e osservabilità
-----------------------------------

Test e osservabilità sono considerati, erroneamente, attività da
aggiungere alla fine. Aggiunti alla fine, richiedono di riscrivere
porzioni consistenti del codice per renderlo testabile e osservabile.
Costruiti dall\'inizio, non hanno costo incrementale percepibile.

16.4 Inseguire la velocità iniziale
-----------------------------------

Le prime settimane di sviluppo assistito da AI producono un senso di
velocità straordinario. Questa velocità è ingannevole: ogni decisione
presa in fretta nelle prime settimane si paga con settimane di
correzione nei mesi successivi. La velocità sostenibile è inferiore alla
velocità iniziale apparente, e accettarlo è il primo atto di saggezza
ingegneristica.

16.5 Non scrivere decisioni architetturali
------------------------------------------

Ogni decisione architetturale non documentata diventa, nel giro di mesi,
una decisione misteriosa di cui nessuno ricorda il motivo. Quando
qualcuno propone di cambiarla, nessuno sa quali conseguenze preveniva.
La documentazione delle decisioni, attraverso Architecture Decision
Records, è una pratica a basso costo e ad altissimo valore.

Capitolo XVII --- Conclusione: La Disciplina Enterprise
=======================================================

Questo libro non contiene segreti. Le tecniche descritte nelle sue
pagine sono note da decenni nella letteratura dell\'ingegneria del
software. Ciò che lo distingue non è la novità dei contenuti, ma
l\'affermazione che queste tecniche sono ancora valide, e necessarie,
nell\'era dell\'intelligenza artificiale. L\'AI non ha abolito
l\'ingegneria: l\'ha resa più urgente.

Il metodo enterprise è una disciplina, nel senso etimologico di
apprendimento sistematico. Richiede di rinunciare alla gratificazione
immediata della velocità apparente in favore della soddisfazione, più
profonda e più duratura, di un sistema che non si rompe. Richiede di
accettare che la parte più importante del lavoro avviene prima del primo
commit e dopo l\'ultimo. Richiede di riconoscere che l\'AI è uno
strumento potente ma non è un architetto.

Chi ha seguito il metodo fino in fondo dispone, alla fine, di un
software che soddisfa i cinque criteri dello standard enterprise. È un
software prevedibile, stabile, leggibile, estendibile, monitorato. È un
software che può essere venduto con fiducia, scalato senza collassare,
mantenuto senza riscrivere. È un software che, in una parola, funziona.

> Un software perfetto non è un software privo di difetti. È un sistema
> controllabile, stabile ed evolvibile. Tutto il resto è letteratura.

Il metodo descritto in questo libro è il punto di arrivo di un percorso
che comincia con la comprensione del primo volume. Chi ha imparato a
recuperare sa perché costruire bene è importante. Chi ha imparato a
costruire bene sa perché il recupero, un giorno, potrebbe non servire
mai. Questo è il fine ultimo del metodo: rendere superfluo il metodo che
lo precede.

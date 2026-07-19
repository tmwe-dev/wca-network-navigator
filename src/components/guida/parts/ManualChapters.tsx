/**
 * Parte 3 · Manuale illustrato (foto pagine reali) — capitoli M1..M8.
 * Contenuto statico estratto da GuidaPage per rispettare il budget LOC.
 */
import SectionWrapper from "@/components/guida/SectionWrapper";
import ManualChapter from "@/components/guida/ManualChapter";
import shotConfig from "@/assets/guida/screenshots/settings.png";
import shotAgentsHub from "@/assets/guida/screenshots/agents-hub.png";
import shotCapabilities from "@/assets/guida/screenshots/agent-capabilities.png";
import shotAiPrompt from "@/assets/guida/screenshots/cfg-ai-prompt.png";
import shotVoce from "@/assets/guida/screenshots/cfg-voce-ai.png";
import shotKb from "@/assets/guida/screenshots/kb-tab.png";
import shotProcessi from "@/assets/guida/screenshots/cfg-processi.png";
import shotAutopilot from "@/assets/guida/screenshots/autopilot.png";
import {
  Brain, Bot, Settings, Workflow, Library, Volume2, Power, SlidersHorizontal,
} from "lucide-react";

export function ManualChapters() {
  return (
    <>
      <SectionWrapper className="bg-[#0a0a0f]">
        <div className="space-y-6 max-w-4xl">
          <span className="text-primary text-xs font-bold tracking-widest uppercase">Parte 3 · Manuale illustrato</span>
          <h2 className="text-4xl font-bold text-white">Il libro del sistema</h2>
          <p className="text-lg text-white/50 leading-relaxed">
            Le pagine che seguono sono <span className="text-white/80">foto reali del programma</span>:
            spiegano dove configurare le parti vitali, come istruire gli agenti e i servizi AI con i
            prompt, come aggiornare la Knowledge Base e come leggere e organizzare le attività
            automatizzate. Per ogni schermata trovi <span className="text-white/70">dove si trova</span>,
            <span className="text-white/70"> cosa puoi fare</span> e <span className="text-white/70">come si aggiorna</span>.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
              <div className="flex items-center gap-2 text-primary"><Settings className="w-5 h-5" /><h3 className="font-bold text-white">Tutto parte da Config</h3></div>
              <p className="text-sm text-white/50">La configurazione vitale (connessioni, agenti, voce, prompt, KB, processi automatici) vive nei gruppi del menu sinistro di <span className="font-mono text-white/70">/v2/settings</span>.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-2">
              <div className="flex items-center gap-2 text-primary"><Brain className="w-5 h-5" /><h3 className="font-bold text-white">Il Cervello del sistema</h3></div>
              <p className="text-sm text-white/50">Agenti, capacità/tool, prompt, provider AI e memoria sono ciò che determina <span className="text-white/70">come</span> il sistema pensa e scrive.</p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      <ManualChapter
        number="01" area="Config · impostazioni di sistema" icon={Settings}
        title="Dove si configura il sistema" subtitle="La mappa dei gruppi di impostazioni"
        path="/v2/settings"
        screenshot={shotConfig} screenshotAlt="Pagina Config con i gruppi di impostazioni nel menu sinistro"
        intro="Config è il pannello centrale. Il menu a sinistra raggruppa tutte le impostazioni per area: ogni gruppo si espande e mostra i suoi tab. Da qui controlli le parti vitali del programma."
        blocks={[
          { kind: "where", title: "I gruppi (menu sx)", items: [
            "GENERALI: Generale, Connessioni, Estensioni, Report Aziende, Notifiche, Timing & Schedule",
            "AGENTI: Voce AI, AI & Prompt, Provider AI",
            "CONTATORI: AI Monitor, Processi Automatici, Token AI, Memoria AI",
            "POSTA: Download Email, Caselle Aziendali · TEAM: Operatori, Ruoli, Utenti autorizzati",
          ]},
          { kind: "do", title: "Cosa imposti qui", items: [
            "Le connessioni email (SMTP/IMAP) e le estensioni",
            "Numero WhatsApp e Profilo AI (tab in alto)",
            "Lingua interfaccia e intensità del testo",
            "Accessi del team e permessi (RBAC)",
          ]},
          { kind: "update", title: "Come ci si muove", items: [
            "Clic sul gruppo per espanderlo, poi sul tab desiderato",
            "Il badge numerico indica quanti tab contiene il gruppo",
            "Ogni modifica ha il suo pulsante Salva nel riquadro",
          ]},
        ]}
        tip="Regola pratica: se cerchi 'dove si imposta X', parte quasi sempre da Config. Connessioni e caselle email → GENERALI/POSTA; tutto ciò che riguarda l'IA → AGENTI e CONTATORI."
      />

      <ManualChapter
        number="02" area="Cervello · agenti" icon={Bot}
        title="Come istruire gli agenti" subtitle="Il roster dei consulenti AI e la loro persona"
        path="/v2/intelligence/agents"
        screenshot={shotAgentsHub} screenshotAlt="Hub conversazionale con il roster degli agenti AI"
        intro="Ogni agente ha un nome, un ruolo (Director, Sales, Outreach, Research, Account…), una persona (tono e stile) e un set di tool abilitati. Selezioni un agente dalla barra in alto per parlarci e gestirlo."
        blocks={[
          { kind: "where", title: "Dove si trova", items: [
            "Menu → Cervello → Agenti (hub conversazionale)",
            "Barra orizzontale in alto: tutti gli agenti con ruolo",
            "Pulsante 'Directory' per la vista elenco completa",
          ]},
          { kind: "do", title: "Cosa puoi fare", items: [
            "Selezionare un agente e avviare una conversazione",
            "Vederne ruolo, n° tool e stato (Attivo/spento)",
            "Editare la persona (tono, stile, istruzioni)",
            "Attivare/disattivare l'agente",
          ]},
          { kind: "update", title: "Come si aggiorna", items: [
            "Apri l'agente → modifica persona/istruzioni → salva",
            "Le nuove istruzioni valgono dalle conversazioni successive",
            "Le capacità (tool) si gestiscono in 'Capacità & Tool' (cap. 03)",
          ]},
        ]}
        tip="La persona definisce COME parla l'agente; i tool definiscono COSA può fare; la Knowledge Base definisce COSA sa. Sono tre leve distinte: per cambiare il comportamento agisci sulla persona, non sui prompt email."
      />

      <ManualChapter
        number="03" area="Cervello · capacità" icon={SlidersHorizontal}
        title="Capacità e tool degli agenti" subtitle="Cosa ciascun agente è autorizzato a fare"
        path="/v2/agents/capabilities"
        screenshot={shotCapabilities} screenshotAlt="Pagina capacità agenti con tool assegnati e gap operativi"
        intro="Qui vedi, per ogni agente, quali tool sono assegnati (es. search_partners, save_memory), la percentuale di copertura e i 'gap operativi' (i tool ancora mancanti, raggruppati per dominio)."
        blocks={[
          { kind: "where", title: "Dove si trova", items: [
            "Barra agenti in alto con la % di copertura tool",
            "'Tool Assegnati': elenco attivo per l'agente scelto",
            "'Gap Operativi': i tool mancanti per dominio (Partner, CRM, Ricerca…)",
          ]},
          { kind: "do", title: "Cosa puoi fare", items: [
            "Confrontare la copertura tra agenti",
            "Capire perché un agente non riesce a fare un'azione",
            "Identificare quali tool abilitare per colmare i gap",
          ]},
          { kind: "update", title: "Come si aggiorna", items: [
            "Assegna i tool mancanti all'agente per aumentare la copertura",
            "Le azioni 'send/destructive' vanno abilitate con cautela (governance)",
            "L'utilizzo reale è tracciato dalla tabella agent_tasks",
          ]},
        ]}
        tip="Una copertura bassa (es. 9%) spiega un agente 'che non sa fare niente': non è un bug del modello, mancano i tool. Aggiungi i tool del dominio giusto invece di riscrivere il prompt."
      />

      <ManualChapter
        number="04" area="Config · AGENTI" icon={Brain}
        title="Servizi AI: prompt e provider" subtitle="I prompt operativi e il modello che li esegue"
        path="/v2/settings?tab=ai-prompt"
        screenshot={shotAiPrompt} screenshotAlt="Tab AI & Prompt con i prompt raggruppati per fase"
        intro="In 'AI & Prompt' gestisci i prompt operativi che guidano email e azioni, organizzati per fase (Primo contatto, Follow-up, Richiesta, Proposta servizi…). In 'Provider AI' scegli il modello che li esegue."
        blocks={[
          { kind: "where", title: "Dove si trova", items: [
            "Config → AGENTI → AI & Prompt (tab in alto: Prompt / Knowledge Base / Template / Deep Search)",
            "Config → AGENTI → Provider AI per il modello",
            "Ogni prompt mostra obiettivo, tipo e tag (Goal/Tipo Email)",
          ]},
          { kind: "do", title: "Cosa puoi fare", items: [
            "Leggere e modificare i prompt esistenti",
            "Creare un nuovo prompt con '+ Crea nuovo'",
            "Marcare un prompt come 'default' per la sua fase",
            "Scegliere provider e modello AI (es. Gemini 2.5 Flash)",
          ]},
          { kind: "update", title: "Come si aggiorna", items: [
            "Apri la scheda prompt → modifica testo/obiettivo → salva",
            "I prompt sono versionati e testabili nel Lab prima del rilascio",
            "Il modello scelto vale per le risposte successive",
          ]},
        ]}
        tip="I prompt qui sono la 'strategia commerciale' scritta: per cambiare il modo in cui il sistema scrive le email, modifica il prompt della fase giusta — non serve toccare il codice."
      />

      <ManualChapter
        number="05" area="Config · AGENTI" icon={Volume2}
        title="Voce AI" subtitle="Lingua, voce e agente vocale"
        path="/v2/settings?tab=voce-ai"
        screenshot={shotVoce} screenshotAlt="Tab Voce AI con lingua, voce predefinita e Voice ID"
        intro="Da 'Voce AI' imposti la lingua vocale (TTS/STT), abiliti le risposte vocali dell'assistente, scegli la voce predefinita o un Voice ID personalizzato di ElevenLabs e l'agente che la userà."
        blocks={[
          { kind: "where", title: "Dove si trova", items: [
            "Config → AGENTI → Voce AI",
            "Tab interni: 'Voce & Agente' e 'Avanzate'",
          ]},
          { kind: "do", title: "Cosa puoi fare", items: [
            "Scegliere la lingua vocale (es. Italiano)",
            "Attivare 'Risposte vocali nell'assistente'",
            "Selezionare la voce predefinita e ascoltarne l'anteprima (▶)",
            "Incollare un Voice ID dalla Voice Library di ElevenLabs",
          ]},
          { kind: "update", title: "Come si aggiorna", items: [
            "Premi 'Aggiorna' per ricaricare le voci disponibili",
            "Inserisci il Voice ID e premi 'Salva'",
            "Associa l'agente AI che userà quella voce",
          ]},
        ]}
        tip="Se non senti audio: verifica che 'Risposte vocali' sia attivo e che una voce sia selezionata. In caso di problemi con ElevenLabs è previsto un fallback alla voce del browser."
      />

      <ManualChapter
        number="06" area="Config · AGENTI" icon={Library}
        title="Knowledge Base: cosa sa il sistema" subtitle="Le schede di conoscenza e come aggiornarle"
        path="/v2/settings?tab=ai-prompt"
        screenshot={shotKb} screenshotAlt="Tab Knowledge Base con schede per categoria"
        intro="La Knowledge Base è la conoscenza fattuale che alimenta le risposte (grounding). Le schede sono organizzate in categorie (es. AGENT_DOCTRINE) e ciascuna è attivabile, modificabile o eliminabile."
        blocks={[
          { kind: "where", title: "Dove si trova", items: [
            "Config → AGENTI → AI & Prompt → tab 'Knowledge Base'",
            "Contatore in alto: schede totali, categorie e quante attive",
            "Ricerca e filtro per categoria",
          ]},
          { kind: "do", title: "Cosa puoi fare", items: [
            "Cercare una scheda o filtrare per categoria",
            "Leggere il contenuto (es. WCA, IATA, doctrine agenti)",
            "Valutare la priorità della scheda (stelle)",
          ]},
          { kind: "update", title: "Come si aggiorna", items: [
            "'+ Nuova scheda' per aggiungere conoscenza",
            "Icona matita per modificare una scheda esistente",
            "Icona cestino per rimuovere (soft-delete)",
          ]},
        ]}
        tip="Per insegnare un fatto nuovo al sistema (un servizio, un argomento di vendita, una regola), aggiungi o aggiorna una scheda KB: comparirà nel grounding delle risposte. Non serve modificare i prompt."
      />

      <ManualChapter
        number="07" area="Config · CONTATORI" icon={Power}
        title="Le attività automatizzate" subtitle="Accendere, spegnere e regolare i worker"
        path="/v2/settings?tab=processi-automatici"
        screenshot={shotProcessi} screenshotAlt="Processi AI automatici con interruttori, frequenza e costo stimato"
        intro="Qui leggi e governi i processi che lavorano da soli: Outreach Scheduler, Email Sync, Agent Autonomo, Autopilot Worker. Per ognuno vedi stato, frequenza, costo stimato, ultimo run ed errori."
        blocks={[
          { kind: "where", title: "Dove si trova", items: [
            "Config → CONTATORI → Processi Automatici",
            "Una card per worker con interruttore ON/OFF",
            "'Ultimo run', 'Prossimo' ed 'Errori 24h' per ogni worker",
          ]},
          { kind: "do", title: "Cosa puoi fare", items: [
            "Accendere/spegnere ciascun worker",
            "Regolare la frequenza (es. ogni 5/10/15 minuti)",
            "Leggere il costo stimato mensile e i run/giorno",
            "Verificare se ci sono errori recenti",
          ]},
          { kind: "update", title: "Come si aggiorna", items: [
            "Cambia la frequenza dal menu a tendina per controllare i costi",
            "Spegni un worker che non ti serve per azzerarne il costo",
            "Controlla 'Errori 24h: 0' per confermare che gira sano",
          ]},
        ]}
        tip="Questa è la plancia delle automazioni: se l'email non arriva controlla 'Email Sync'; se l'outreach non parte controlla 'Outreach Scheduler'; se vuoi risparmiare token abbassa la frequenza."
      />

      <ManualChapter
        number="08" area="Comando · autopilot" icon={Workflow}
        title="Autopilot e attività degli agenti" subtitle="Missioni autonome e task generati"
        path="/v2/agents/autopilot"
        screenshot={shotAutopilot} screenshotAlt="Pagina Agent Missions con creazione nuova missione"
        intro="Le Missioni Autopilot fanno lavorare gli agenti su obiettivi commerciali entro KPI e budget. I task generati sono tracciati e consultabili: così leggi e organizzi ciò che il sistema fa in autonomia."
        blocks={[
          { kind: "where", title: "Dove si trova", items: [
            "Menu → Comando → Missioni Autopilot",
            "'+ Nuova Missione' per crearne una",
            "Le attività generate sono in 'Agent Tasks'",
          ]},
          { kind: "do", title: "Cosa puoi fare", items: [
            "Creare una missione con obiettivo, target e budget/KPI",
            "Monitorarne l'avanzamento e gli stati",
            "Mettere in pausa / riprendere / chiudere",
            "Leggere i task prodotti per ogni agente",
          ]},
          { kind: "update", title: "Come si aggiorna", items: [
            "Crea/avvia la missione → l'Autopilot Worker la fa avanzare",
            "Le approvazioni richieste compaiono per le azioni sensibili",
            "Il worker Autopilot va tenuto attivo (cap. 07)",
          ]},
        ]}
        tip="Schema mentale: la Missione fissa l'obiettivo, l'Autopilot Worker la esegue ai ritmi di Processi Automatici, i Task ne sono il diario. Per 'far lavorare il sistema da solo' bastano queste tre cose accese."
      />
    </>
  );
}
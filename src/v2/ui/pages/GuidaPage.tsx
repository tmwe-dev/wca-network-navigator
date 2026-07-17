/**
 * GuidaPage V2
 */
import GuidaLayout from "@/components/guida/GuidaLayout";
import CoverSection from "@/components/guida/CoverSection";
import VisionSection from "@/components/guida/VisionSection";
import PerformanceSection from "@/components/guida/PerformanceSection";
import AgentTeamSection from "@/components/guida/AgentTeamSection";
import AutonomousCycleSection from "@/components/guida/AutonomousCycleSection";
import OutreachSection from "@/components/guida/OutreachSection";
import GlobalNetworkSection from "@/components/guida/GlobalNetworkSection";
import DeepSearchSection from "@/components/guida/DeepSearchSection";
import MultichannelSection from "@/components/guida/MultichannelSection";
import ProspectSection from "@/components/guida/ProspectSection";
import SecuritySection from "@/components/guida/SecuritySection";
import ResultsSection from "@/components/guida/ResultsSection";
import RoadmapSection from "@/components/guida/RoadmapSection";
import ClosingSection from "@/components/guida/ClosingSection";
import SectionWrapper from "@/components/guida/SectionWrapper";
import TutorialChapter from "@/components/guida/TutorialChapter";
import ManualChapter from "@/components/guida/ManualChapter";
// Foto reali delle pagine (catturate dal sistema in uso)
import shotConfig from "@/assets/guida/screenshots/settings.png";
import shotAgentsHub from "@/assets/guida/screenshots/agents-hub.png";
import shotCapabilities from "@/assets/guida/screenshots/agent-capabilities.png";
import shotAiPrompt from "@/assets/guida/screenshots/cfg-ai-prompt.png";
import shotVoce from "@/assets/guida/screenshots/cfg-voce-ai.png";
import shotKb from "@/assets/guida/screenshots/kb-tab.png";
import shotProcessi from "@/assets/guida/screenshots/cfg-processi.png";
import shotAutopilot from "@/assets/guida/screenshots/autopilot.png";
import {
  Command, Target, Search, Rocket, Calendar, Trash2,
  MessagesSquare, Inbox, Mail, Brain, Sparkles, Contact,
  Bot, Cpu, FlaskConical, Settings, Workflow, BookOpenCheck,
  Library, Volume2, Power, SlidersHorizontal,
} from "lucide-react";

const sectionLabels = [
  // === Parte 1: istituzionale ===
  "Copertina", "Tagline", "La Sfida",
  "Prima/Dopo", "Pilastri", "Stack",
  "Performance", "Impatto",
  "Team AI", "Ciclo Decisionale", "Ciclo Autonomo",
  "Outreach AI",
  "Rete Globale", "Deep Search", "Multi-Channel",
  "Prospect", "Sicurezza", "Risultati", "Roadmap",
  // === Parte 2: tutorial operativo ===
  "Guida ai test",
  "1a · Command", "1b · Missioni",
  "2a · Esplora",
  "3a · Cockpit", "3b · Agenda", "3c · Cestinone",
  "4a · Comms", "4b · Inbox", "4c · Email", "4d · Email Intel", "4e · Funnemail", "4f · Rubriche",
  "5a · Agenti", "5b · Intelligence",
  "6 · Lab",
  "7 · Config",
  "8 · Automazioni",
  // === Parte 3: manuale illustrato (foto pagine) ===
  "Manuale",
  "M1 · Config",
  "M2 · Istruire agenti",
  "M3 · Capacità & Tool",
  "M4 · Prompt & Provider",
  "M5 · Voce AI",
  "M6 · Knowledge Base",
  "M7 · Processi automatici",
  "M8 · Autopilot & Attività",
  // === Chiusura ===
  "Chiusura",
];

const Guida = () => {
  return (
    <GuidaLayout sectionLabels={sectionLabels}>
      {/* === PARTE 1: ISTITUZIONALE (~15 sezioni) === */}
      <CoverSection />
      <VisionSection />
      <PerformanceSection />
      <AgentTeamSection />
      <AutonomousCycleSection />
      <OutreachSection />
      <GlobalNetworkSection />
      <DeepSearchSection />
      <MultichannelSection />
      <ProspectSection />
      <SecuritySection />
      <ResultsSection />
      <RoadmapSection />

      {/* === PARTE 2: TUTORIAL OPERATIVO === */}

      {/* CAP. 0 — Come usare la guida ai test */}
      <SectionWrapper className="bg-[#0a0a0f]">
        <div className="space-y-8 max-w-4xl">
          <div className="space-y-3">
            <span className="text-primary text-xs font-bold tracking-widest uppercase">Parte 2 · Tutorial operativo</span>
            <h2 className="text-4xl font-bold text-white">Come usare questa guida</h2>
            <p className="text-lg text-white/50 leading-relaxed">
              I capitoli seguono l'ordine esatto del menu (le 7 macro-aree: Comando, Esplora,
              Pipeline, Comunica, Cervello, Lab, Config). Per ogni sezione trovi cosa fa, le
              operazioni possibili e una checklist di test per verificare che tutto funzioni.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-2">
              <div className="flex items-center gap-2 text-primary"><BookOpenCheck className="w-5 h-5" /><h3 className="font-bold text-white">Struttura capitolo</h3></div>
              <p className="text-sm text-white/50">Cosa fa → Operazioni possibili → Test di verifica. Il percorso della pagina è indicato in alto a destra.</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
              <div className="flex items-center gap-2 text-primary"><FlaskConical className="w-5 h-5" /><h3 className="font-bold text-white">Legenda test</h3></div>
              <p className="text-sm text-white/50">Ogni test è <span className="text-white/70">Azione</span> + <span className="text-success font-medium">Atteso</span>. Se l'esito non corrisponde, la funzione va segnalata.</p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* CAP. 1 — COMANDO */}
      <TutorialChapter
        chapter="CAP. 01" area="Comando" icon={Command}
        title="Command" subtitle="L'agente AI in linguaggio naturale" path="/v2/command"
        description="Il centro di controllo conversazionale. Scrivi (o parli) richieste in linguaggio naturale: l'AI consulta memoria, Knowledge Base e dati, esegue tool e mostra fonti e risultati con audit completo."
        operations={[
          "Chiedere dati ('quanti partner in USA?') e ricevere risposta con fonti",
          "Avviare azioni: comporre email, cercare partner, creare reminder",
          "Attivare la voce real-time con il pulsante accanto al microfono",
          "Approvare/correggere le azioni che richiedono conferma (write/send)",
          "Rivedere lo storico della conversazione con tool e obiettivi falliti evidenziati",
        ]}
        tests={[
          { action: "Scrivi 'quanti partner abbiamo a Malta' e invia.", expect: "Risposta numerica con fonte/tool citato, niente '0 risultati' se i dati esistono." },
          { action: "Chiedi 'scrivi una mail di presentazione a un partner di Malta'.", expect: "L'AI mantiene il contesto e propone una bozza, non perde il riferimento al paese." },
          { action: "Premi il toggle voce (icona Radio) accanto al microfono.", expect: "Si attiva la modalità real-time; in caso di errore socket parte il retry WebRTC." },
          { action: "Dai un comando che modifica dati (es. crea agente).", expect: "Compare un pannello di approvazione prima dell'esecuzione." },
        ]}
        screenshotContent={
          <div className="space-y-3">
            <div className="p-3 rounded bg-white/5 border border-white/10 text-xs text-white/60">
              <span className="text-primary">›</span> quanti partner abbiamo negli Stati Uniti?
            </div>
            <div className="p-3 rounded bg-primary/5 border border-primary/20 text-xs text-white/60">
              <Sparkles className="w-4 h-4 text-primary inline mr-1" />
              195 partner negli USA. <span className="text-white/40">Fonte: tool partner-search · DB partners</span>
            </div>
          </div>
        }
      />

      <TutorialChapter
        chapter="CAP. 01b" area="Comando" icon={Target}
        title="Missioni Autopilot" subtitle="Automazioni con KPI, budget e approvazioni" path="/v2/agents/autopilot" reversed
        description="Le missioni fanno lavorare l'AI in autonomia su obiettivi commerciali (outreach, follow-up) entro KPI e budget definiti, chiedendo conferma solo per le decisioni che contano."
        operations={[
          "Creare una missione con obiettivo, target e cadenza",
          "Impostare budget e tetto crediti AI",
          "Monitorare avanzamento e KPI in tempo reale",
          "Approvare gli step che richiedono conferma umana",
          "Mettere in pausa / riprendere / chiudere una missione",
        ]}
        tests={[
          { action: "Crea una nuova missione e salva.", expect: "La missione compare nell'elenco con stato attivo e KPI a zero." },
          { action: "Apri una missione e controlla budget/cadenza.", expect: "I valori impostati sono persistiti e mostrati correttamente." },
          { action: "Metti in pausa la missione.", expect: "Lo stato passa a 'in pausa' e non genera nuove azioni." },
        ]}
        screenshotContent={
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded bg-white/5 text-xs text-white/60"><span>Outreach Malta Q3</span><span className="text-success">● attiva</span></div>
            <div className="flex items-center justify-between p-2 rounded bg-white/5 text-xs text-white/60"><span>Follow-up no-reply</span><span className="text-warning">● in pausa</span></div>
          </div>
        }
      />

      {/* CAP. 2 — ESPLORA */}
      <TutorialChapter
        chapter="CAP. 02" area="Esplora" icon={Search}
        title="Esplora Network" subtitle="Ricerca e gestione partner" path="/v2/explore/network"
        description="La rete partner navigabile con filtri avanzati, deep search e azioni batch. Dalla griglia paesi alla lista partner con dettaglio contatti, certificazioni e rating."
        operations={[
          "Filtrare per paese, network, certificazioni (IATA, ISO, AEO), servizi, rating",
          "Avviare Deep Search per arricchire i contatti",
          "Selezione multipla con azioni batch",
          "Aprire il dettaglio partner con contatti, social e rating",
          "Assegnare un gruppo o aggiungere a una pipeline",
        ]}
        tests={[
          { action: "Applica un filtro paese (es. Italia).", expect: "La lista si aggiorna mostrando solo i partner del paese." },
          { action: "Avvia una Deep Search su un partner.", expect: "Barra di progresso con possibilità di stop; al termine compaiono nuovi contatti." },
          { action: "Seleziona più partner e apri le azioni batch.", expect: "Le azioni disponibili agiscono su tutti i selezionati." },
        ]}
        screenshotContent={
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {["Italia", "IATA ✓", "ISO 9001 ✓", "★★★★☆"].map(f => (
                <span key={f} className="px-2 py-1 rounded-full bg-white/5 text-xs text-white/60">{f}</span>
              ))}
            </div>
            <div className="p-3 rounded bg-white/5 border border-white/10 text-xs text-white/60">ABC Logistics · Milano · ★★★★☆</div>
          </div>
        }
      />

      {/* CAP. 3 — PIPELINE */}
      <TutorialChapter
        chapter="CAP. 03a" area="Pipeline" icon={Rocket}
        title="Cockpit" subtitle="Pipeline Kanban dei lead" path="/v2/cockpit" reversed
        description="La pipeline commerciale a colonne (stage). Trascini i lead tra gli stati, vedi lo scoring e agisci direttamente su ogni scheda."
        operations={[
          "Spostare i lead tra gli stage (drag & drop)",
          "Aprire una scheda lead con storico e azioni",
          "Filtrare per stato, scoring o owner",
          "Avviare outreach o follow-up dalla scheda",
        ]}
        tests={[
          { action: "Trascina un lead in un altro stage.", expect: "Lo stato si aggiorna e resta persistito dopo refresh." },
          { action: "Apri una scheda lead.", expect: "Mostra storico contatti, scoring e azioni rapide." },
        ]}
        screenshotContent={
          <div className="grid grid-cols-3 gap-2">
            {["Nuovo", "In corso", "Cliente"].map(s => (
              <div key={s} className="p-2 rounded bg-white/5 text-xs text-white/60 text-center">{s}</div>
            ))}
          </div>
        }
      />

      <TutorialChapter
        chapter="CAP. 03b" area="Pipeline" icon={Calendar}
        title="Agenda" subtitle="Reminder e follow-up" path="/v2/agenda"
        description="Il calendario delle attività: reminder con priorità, follow-up collegati ai partner e gestione batch delle scadenze."
        operations={[
          "Creare reminder con priorità (alta/media/bassa)",
          "Collegare un'attività a un partner",
          "Gestione batch: completa / annulla",
          "Filtrare per scadenza: oggi, settimana, in ritardo",
        ]}
        tests={[
          { action: "Crea un reminder per oggi.", expect: "Compare nella vista 'oggi' con la priorità scelta." },
          { action: "Segna un'attività come completata.", expect: "Esce dalla lista attive e va nello storico." },
        ]}
        screenshotContent={
          <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">⚠️ 3 attività in scadenza oggi</div>
        }
      />

      <TutorialChapter
        chapter="CAP. 03c" area="Pipeline" icon={Trash2}
        title="Cestinone" subtitle="Soft-delete e ripristino" path="/v2/cestinone" reversed
        description="Nel sistema nessun dato viene cancellato fisicamente: ogni eliminazione è un soft-delete. Da qui consulti e ripristini gli elementi rimossi."
        operations={[
          "Consultare gli elementi eliminati (15 tabelle business)",
          "Ripristinare un elemento soft-deleted",
          "Filtrare per tipo di entità e data",
        ]}
        tests={[
          { action: "Elimina un elemento da un'altra sezione e apri il Cestinone.", expect: "L'elemento compare tra i soft-deleted, non è perso." },
          { action: "Ripristina l'elemento.", expect: "Torna visibile nella sezione di origine." },
        ]}
        screenshotContent={
          <div className="p-3 rounded bg-white/5 border border-white/10 text-xs text-white/60">Partner · ABC Srl · eliminato 2 giorni fa · <span className="text-primary">Ripristina</span></div>
        }
      />

      {/* CAP. 4 — COMUNICA */}
      <TutorialChapter
        chapter="CAP. 04a" area="Comunica" icon={MessagesSquare}
        title="Comms" subtitle="WhatsApp + LinkedIn (stealth sync)" path="/v2/comms"
        description="Il centro multicanale per le conversazioni WhatsApp e LinkedIn, sincronizzate in modalità stealth tramite le estensioni dedicate."
        operations={[
          "Vedere le conversazioni WhatsApp e LinkedIn unificate",
          "Rispondere ai messaggi (con editorial review sul testo prodotto)",
          "Collegare una conversazione a un partner/lead",
          "Verificare lo stato di sync delle estensioni",
        ]}
        tests={[
          { action: "Apri Comms con estensione WhatsApp attiva.", expect: "Le conversazioni recenti compaiono sincronizzate." },
          { action: "Genera una risposta AI.", expect: "Passa per la revisione editoriale prima dell'invio." },
        ]}
        screenshotContent={
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded bg-white/5 text-xs text-white/60"><MessagesSquare className="w-4 h-4 text-success" /> WhatsApp · 4 nuove</div>
            <div className="flex items-center gap-2 p-2 rounded bg-white/5 text-xs text-white/60"><Contact className="w-4 h-4 text-info" /> LinkedIn · 2 nuove</div>
          </div>
        }
      />

      <TutorialChapter
        chapter="CAP. 04b" area="Comunica" icon={Inbox}
        title="Inbox" subtitle="Posta in arrivo" path="/v2/inbox" reversed
        description="La casella email sincronizzata via IMAP (in PEEK, senza segnare come letto). Leggi, classifichi e trasformi le email in attività."
        operations={[
          "Leggere le email sincronizzate senza alterarne lo stato sul server",
          "Vedere il contenuto anche di messaggi sovradimensionati (troncati)",
          "Classificare e assegnare gruppo mittente",
          "Creare un'attività/follow-up da un'email",
        ]}
        tests={[
          { action: "Apri un'email non letta.", expect: "Resta 'non letta' sul server (IMAP PEEK)." },
          { action: "Apri un'email molto grande.", expect: "Viene mostrata almeno una parte del testo, non un errore." },
        ]}
        screenshotContent={
          <div className="p-3 rounded bg-white/5 border border-white/10 text-xs text-white/60">Da: luca.arcana@… · Oggetto: Richiesta preventivo</div>
        }
      />

      <TutorialChapter
        chapter="CAP. 04c" area="Comunica" icon={Mail}
        title="Email" subtitle="Composizione e invio con revisione editoriale" path="/v2/email"
        description="Lo spazio per comporre email personalizzate (anche generate dall'AI sul profilo partner). Ogni messaggio passa per la revisione editoriale obbligatoria prima dell'invio."
        operations={[
          "Comporre email con variabili dinamiche e template",
          "Generare bozze AI basate sul profilo del partner",
          "Selezionare destinatari singoli o batch",
          "Inviare via SMTP configurato (diretto o in coda)",
        ]}
        tests={[
          { action: "Genera una bozza AI per un partner.", expect: "Viene prodotta e mostrata la revisione editoriale prima dell'invio." },
          { action: "Invia un'email di test a un destinatario.", expect: "Conferma di invio e tracciamento; nessun invio duplicato." },
        ]}
        screenshotContent={
          <div className="p-3 rounded bg-white/5 border border-white/10 text-xs text-white/60">Subject: Partnership — {"{{city}}"} corridor</div>
        }
      />

      <TutorialChapter
        chapter="CAP. 04d" area="Comunica" icon={Brain}
        title="Email Intelligence" subtitle="Classificazione risposte ed escalation" path="/v2/email-intelligence" reversed
        description="L'AI classifica automaticamente le risposte in arrivo (interessato, non interessato, info, bounce…) e aggiorna lo stato del lead, scalando quando serve."
        operations={[
          "Vedere le email classificate per categoria",
          "Correggere una classificazione errata (l'AI impara)",
          "Gestire le escalation di lead status",
          "Monitorare i bounce e la soppressione automatica",
        ]}
        tests={[
          { action: "Apri un'email classificata e correggi la categoria.", expect: "La correzione viene salvata e usata per l'apprendimento." },
          { action: "Simula una risposta positiva.", expect: "Il lead status si aggiorna/escala coerentemente." },
        ]}
        screenshotContent={
          <div className="flex gap-2 flex-wrap">
            {["Interessato", "Info", "Bounce"].map(c => <span key={c} className="px-2 py-1 rounded-full bg-white/5 text-xs text-white/60">{c}</span>)}
          </div>
        }
      />

      <TutorialChapter
        chapter="CAP. 04e" area="Comunica" icon={Sparkles}
        title="Funnemail" subtitle="Claim e smistamento" path="/v2/funnemail-inbox"
        description="Il sistema di smistamento delle email condivise: gli operatori 'reclamano' (claim) i messaggi di competenza, evitando sovrapposizioni."
        operations={[
          "Reclamare (claim) un'email da lavorare",
          "Smistare per gruppo/competenza",
          "Rilasciare un claim",
        ]}
        tests={[
          { action: "Reclama un'email.", expect: "Risulta assegnata a te e non più disponibile agli altri operatori." },
          { action: "Rilascia il claim.", expect: "Torna disponibile nella coda condivisa." },
        ]}
        screenshotContent={
          <div className="p-3 rounded bg-white/5 border border-white/10 text-xs text-white/60">3 email in coda · <span className="text-primary">Claim</span></div>
        }
      />

      <TutorialChapter
        chapter="CAP. 04f" area="Comunica" icon={Contact}
        title="Rubriche WhatsApp / LinkedIn" subtitle="Contatti dei canali social" path="/v2/rubrica/whatsapp" reversed
        description="Gli elenchi contatti sincronizzati dai canali WhatsApp e LinkedIn, collegabili ai partner per una visione unificata."
        operations={[
          "Consultare i contatti WhatsApp e LinkedIn",
          "Collegare un contatto a un partner/lead",
          "Avviare una conversazione dal contatto",
        ]}
        tests={[
          { action: "Apri la rubrica WhatsApp.", expect: "I contatti sincronizzati sono elencati." },
          { action: "Collega un contatto a un partner.", expect: "Il collegamento è visibile dal profilo partner." },
        ]}
        screenshotContent={
          <div className="p-2 rounded bg-white/5 text-xs text-white/60">+39 333 … · Mario Rossi · collegato a ABC Srl</div>
        }
      />

      {/* CAP. 5 — CERVELLO */}
      <TutorialChapter
        chapter="CAP. 05a" area="Cervello" icon={Bot}
        title="Gestione Agenti" subtitle="Creazione, persona, capabilities e tool" path="/v2/intelligence/agents"
        description="Qui definisci gli agenti AI del sistema: nome, ruolo, persona (tono e stile), capacità abilitate e tool che possono usare. Ogni agente opera sotto governance e guardrail."
        operations={[
          "Creare un nuovo agente con ruolo ed emoji",
          "Editare la persona: tono, stile, istruzioni",
          "Abilitare/disabilitare capabilities e tool",
          "Versionare i prompt e testarli prima del rilascio",
          "Definire il livello di rischio delle azioni (read/write/send/destructive)",
        ]}
        tests={[
          { action: "Crea un nuovo agente dal Command ('crea agente …').", expect: "Compare un pannello di approvazione; dopo conferma l'agente è creato." },
          { action: "Modifica la persona di un agente e salva.", expect: "Le modifiche sono persistite e applicate alle nuove conversazioni." },
          { action: "Disabilita un tool 'send' per un agente.", expect: "L'agente non può più eseguire quell'azione senza riabilitazione." },
        ]}
        screenshotContent={
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded bg-white/5 text-xs text-white/60">🤖 Agente Outreach · ruolo: outreach</div>
            <div className="flex items-center gap-2 p-2 rounded bg-white/5 text-xs text-white/60">🧠 Agente Classificatore · ruolo: classification</div>
          </div>
        }
      />

      <TutorialChapter
        chapter="CAP. 05b" area="Cervello" icon={Cpu}
        title="Intelligence" subtitle="Configurazione dell'IA: provider, voce, memoria, KB" path="/v2/intelligence" reversed
        description="Il pannello che governa l'intelligenza del sistema: quale modello usa, la voce, la memoria conversazionale, la Knowledge Base e i guardrail di costo."
        operations={[
          "Selezionare provider e modello AI (es. Gemini 2.5 Flash)",
          "Configurare la voce (ElevenLabs / fallback browser)",
          "Gestire la memoria conversazionale e i riassunti",
          "Editare la Knowledge Base usata per il grounding",
          "Impostare i guardrail di costo (deep mail gate, tetto token)",
        ]}
        tests={[
          { action: "Cambia provider/modello e salva.", expect: "Il profilo AI è salvato (univoco per utente) e usato nelle nuove risposte." },
          { action: "Avvia una risposta vocale.", expect: "Audio riprodotto; se la voce primaria fallisce parte il fallback." },
          { action: "Poni una domanda coperta dalla KB.", expect: "La risposta cita la fonte KB (grounding attivo)." },
        ]}
        screenshotContent={
          <div className="space-y-2">
            <div className="p-2 rounded bg-white/5 text-xs text-white/60">Modello: Gemini 2.5 Flash</div>
            <div className="p-2 rounded bg-white/5 text-xs text-white/60">Voce: ElevenLabs · fallback browser ✓</div>
          </div>
        }
      />

      {/* CAP. 6 — LAB */}
      <TutorialChapter
        chapter="CAP. 06" area="Lab" icon={FlaskConical}
        title="Lab" subtitle="Prompt Lab, test e observability" path="/v2/lab"
        description="L'officina tecnica: simulatore Prompt Lab, test di regressione sui prompt, observability/metriche e design system. Lo strumento per validare l'IA prima della produzione."
        operations={[
          "Simulare prompt e confrontare versioni (diff)",
          "Eseguire test di regressione sui prompt",
          "Consultare metriche e log strutturati (observability)",
          "Verificare i componenti del design system",
        ]}
        tests={[
          { action: "Apri Prompt Lab e simula un prompt.", expect: "Mostra output e confronto fra versioni." },
          { action: "Lancia i test di regressione.", expect: "Esito pass/fail per ciascun caso." },
        ]}
        screenshotContent={
          <div className="flex gap-2 flex-wrap">
            {["Tests", "Observability", "Design System"].map(g => <span key={g} className="px-2 py-1 rounded-full bg-white/5 text-xs text-white/60">{g}</span>)}
          </div>
        }
      />

      {/* CAP. 7 — CONFIG */}
      <TutorialChapter
        chapter="CAP. 07" area="Config" icon={Settings}
        title="Config (Impostazioni)" subtitle="Tutta la configurazione del sistema" path="/v2/settings" reversed
        description="Le impostazioni sono raggruppate in più tab tematici: Generale, Connessioni, Estensioni, Voce AI, Provider AI, Token AI, Memoria AI, Lab, Operatori, Ruoli e Development."
        operations={[
          "Generale: profilo e preferenze",
          "Connessioni: SMTP/IMAP, credenziali, estensioni",
          "Provider AI / Token AI: modello e monitoraggio costi",
          "Memoria AI: gestione memoria e KB",
          "Operatori / Ruoli: gestione accessi (RBAC, ruoli su tabella dedicata)",
          "Development: pagine tecniche, ogni tab apribile come pagina",
        ]}
        tests={[
          { action: "Apri Connessioni e fai il test SMTP.", expect: "Esito del test di invio mostrato chiaramente." },
          { action: "Apri Token AI.", expect: "Consumo token loggato e visibile per controllo costi." },
          { action: "Apri la tab Development con '↳ Apri pagina'.", expect: "Si apre la pagina dedicata come per le altre sezioni." },
        ]}
        screenshotContent={
          <div className="space-y-1.5">
            {["Generale", "Connessioni", "Provider AI", "Token AI", "Memoria AI", "Ruoli"].map((t, i) => (
              <div key={t} className={`px-3 py-1.5 rounded text-xs ${i === 1 ? "bg-primary/10 text-primary" : "bg-white/5 text-white/60"}`}>{t}</div>
            ))}
          </div>
        }
      />

      {/* CAP. 8 — AUTOMAZIONI (trasversale) */}
      <TutorialChapter
        chapter="CAP. 08" area="Automazioni" icon={Workflow}
        title="Automazioni & Ciclo autonomo" subtitle="Come il sistema lavora da solo, sotto governance"
        description="Il valore del sistema è il ciclo end-to-end automatico: trova il lead, scrive il primo messaggio, fa follow-up, classifica le risposte e tiene viva la relazione — lasciando all'operatore solo approvare, correggere e chiudere."
        operations={[
          "Lead discovery → arricchimento → scoring",
          "Outreach multicanale con cadenze, A/B test e holding pattern",
          "Follow-up automatici sui no-reply",
          "Classificazione risposte ed escalation lead status",
          "Cron di sincronizzazione email e guardrail di costo",
        ]}
        tests={[
          { action: "Avvia una missione di outreach con cadenza.", expect: "I primi messaggi vengono prodotti (con revisione) e accodati." },
          { action: "Lascia passare il tempo di follow-up su un no-reply.", expect: "Viene generato il follow-up previsto dalla cadenza, senza duplicati." },
          { action: "Ricevi una risposta.", expect: "Viene classificata e il lead status aggiornato automaticamente." },
          { action: "Controlla i guardrail di costo.", expect: "L'enrichment automatico resta entro il gate; i token sono tracciati." },
        ]}
        screenshotContent={
          <div className="space-y-2 text-xs text-white/60">
            <div className="flex items-center gap-2"><Search className="w-4 h-4 text-primary" /> Lead trovato → arricchito</div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Primo messaggio inviato</div>
            <div className="flex items-center gap-2"><Workflow className="w-4 h-4 text-primary" /> Follow-up · classificazione · escalation</div>
          </div>
        }
      />

      {/* ============================================================== */}
      {/* === PARTE 3: MANUALE ILLUSTRATO (foto delle pagine reali) === */}
      {/* ============================================================== */}

      {/* Intro manuale */}
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

      {/* M1 — CONFIG: dove si configura tutto */}
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

      {/* M2 — ISTRUIRE GLI AGENTI */}
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

      {/* M3 — CAPACITÀ & TOOL */}
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

      {/* M4 — PROMPT & PROVIDER */}
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

      {/* M5 — VOCE AI */}
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

      {/* M6 — KNOWLEDGE BASE */}
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

      {/* M7 — PROCESSI AUTOMATICI */}
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

      {/* M8 — AUTOPILOT & ATTIVITÀ */}
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

      {/* === CHIUSURA === */}
      <ClosingSection />
    </GuidaLayout>
  );
};

export default Guida;

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
import TutorialSection from "@/components/guida/TutorialSection";
import {
  Globe, Users, Mail, Send, Sparkles, Building2, Calendar, Settings, Chrome, Search, Puzzle,
} from "lucide-react";

const sectionLabels = [
  "Copertina", "Tagline", "La Sfida",
  "Prima/Dopo", "Pilastri", "Stack",
  "Performance", "Impatto",
  "Team AI", "Ciclo Decisionale", "Ciclo Autonomo",
  "Outreach AI",
  "Rete Globale", "Deep Search", "Multi-Channel",
  "Prospect", "Sicurezza", "Risultati", "Roadmap",
  // Tutorial sections
  "Operations Center", "Partner Hub", "Campaigns", "Email Composer",
  "Email Workspace", "Agenda", "Estensioni Chrome", "Impostazioni",
  // Closing
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

      {/* === PARTE 2: TUTORIAL DETTAGLIATO === */}
      <TutorialSection
        badge="Tutorial"
        icon={Globe}
        title="Operations Center"
        subtitle="Dashboard centrale per la gestione globale"
        description="Il cuore operativo del sistema. Da qui controlli download, monitori job in background, e gestisci l'intera rete di partner con un colpo d'occhio."
        features={[
          { text: "Griglia paesi con statistiche: partner, email, telefoni, copertura" },
          { text: "Job di download in background con terminale live" },
          { text: "Pannello partner per paese con dettaglio contatti" },
          { text: "Assistente AI integrato per analisi e suggerimenti" },
          { text: "Indicatore stato sessione WCA in tempo reale" },
        ]}
        screenshotContent={
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {["🇮🇹 Italy (324)", "🇩🇪 Germany (218)", "🇺🇸 USA (195)"].map(c => (
                <div key={c} className="p-2 rounded bg-white/5 text-xs text-white/50 text-center">{c}</div>
              ))}
            </div>
            <div className="p-3 rounded bg-white/5 border border-white/10">
              <span className="text-xs text-emerald-400">● Terminal Live</span>
              <div className="mt-2 text-xs text-white/30 font-mono space-y-1">
                <p>[14:32] Downloading IT partner 142/324...</p>
                <p>[14:33] ✓ Found 3 contacts for ABC Srl</p>
              </div>
            </div>
          </div>
        }
      />

      <TutorialSection
        badge="Tutorial"
        icon={Users}
        title="Partner Hub"
        subtitle="Navigazione e gestione partner WCA"
        description="Navigazione a 3 livelli: dalla griglia paesi al workbench paese fino alla lista partner flat. Filtri avanzati per network, certificazioni, servizi e rating."
        reversed
        features={[
          { text: "Filtri: IATA, ISO, AEO, BASC, C-TPAT, servizi, rating" },
          { text: "Deep Search bulk con barra progresso e stop" },
          { text: "Selezione multipla con azioni batch" },
          { text: "Dettaglio partner: contatti, social, rating breakdown" },
          { text: "Mini-globo 3D nella scheda partner" },
        ]}
        screenshotContent={
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {["IATA ✓", "ISO 9001 ✓", "AEO", "BASC"].map(f => (
                <span key={f} className="px-2 py-1 rounded-full bg-white/5 text-xs text-white/40">{f}</span>
              ))}
            </div>
            <div className="p-3 rounded bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">AL</span>
                <div>
                  <p className="text-sm text-white font-medium">ABC Logistics</p>
                  <p className="text-xs text-white/30">Istanbul, Turkey · ★★★★☆</p>
                </div>
              </div>
            </div>
          </div>
        }
      />

      <TutorialSection
        badge="Tutorial"
        icon={Mail}
        title="Campaigns"
        subtitle="Globo 3D interattivo per selezione partner"
        description="Seleziona partner per paese cliccando direttamente sul globo 3D. Filtra per network WCA e invia batch alla coda campaign jobs."
        features={[
          { text: "Globo 3D con marker paese e connessioni animate" },
          { text: "Selezione partner per paese con click sul globo" },
          { text: "Invio batch a Campaign Jobs" },
          { text: "Preview email personalizzata" },
          { text: "Aurora boreale animata come effetto visivo" },
        ]}
        screenshotContent={
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-primary/20 via-blue-500/10 to-transparent border border-white/10 flex items-center justify-center">
              <Globe className="w-16 h-16 text-primary/40" />
            </div>
          </div>
        }
      />

      <TutorialSection
        badge="Tutorial"
        icon={Send}
        title="Email Composer"
        subtitle="Composizione email HTML con variabili dinamiche"
        reversed
        description="Editor completo per comporre email HTML con variabili come {{company_name}}, {{contact_name}}. Selezione destinatari, allegati da template e anteprima live."
        features={[
          { text: "Variabili dinamiche: {{company_name}}, {{contact_name}}, {{city}}" },
          { text: "Selezione destinatari: paese, partner singolo, batch" },
          { text: "Allegati da template per categoria" },
          { text: "Anteprima live con dati reali" },
          { text: "Invio diretto via SMTP configurato" },
        ]}
        screenshotContent={
          <div className="space-y-3">
            <div className="p-3 rounded bg-white/5 border border-white/10">
              <p className="text-xs text-white/30 mb-2">To: info@abc-logistics.com</p>
              <p className="text-xs text-white/50">Subject: Partnership — {"{{city}}"} corridor</p>
            </div>
            <div className="p-3 rounded bg-white/5 text-xs text-white/30">
              Dear {"{{contact_name}}"},<br />
              We would like to explore a partnership with {"{{company_name}}"}...
            </div>
          </div>
        }
      />

      <TutorialSection
        badge="Tutorial"
        icon={Sparkles}
        title="Email Workspace"
        subtitle="Generazione AI personalizzata"
        description="Lo spazio di lavoro per generare email AI basate sul profilo completo del partner. Deep Search integrata, filtri avanzati e canvas email con invio diretto."
        features={[
          { text: "Generazione AI basata su profilo e documenti di riferimento" },
          { text: "Lista contatti con indicatori arricchimento" },
          { text: "Deep Search integrata con progress e stop" },
          { text: "Barra obiettivo con documenti e link configurabili" },
          { text: "Canvas email con anteprima e invio" },
        ]}
        screenshotContent={
          <div className="space-y-3">
            <div className="flex gap-2">
              <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">✓ Enriched</span>
              <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">🌐 Website</span>
              <span className="px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs">in LinkedIn</span>
            </div>
            <div className="p-3 rounded bg-white/5 border border-primary/20 text-xs text-white/40">
              <Sparkles className="w-4 h-4 text-primary inline mr-1" />
              Generating personalized email based on partner profile...
            </div>
          </div>
        }
      />

      <TutorialSection
        badge="Tutorial"
        icon={Calendar}
        title="Agenda"
        subtitle="Calendario reminder e follow-up"
        reversed
        description="Calendario con vista mensile, reminder con priorità e gestione batch delle attività. Collegamento diretto ai partner associati."
        features={[
          { text: "Vista mensile con indicatori giornalieri" },
          { text: "Reminder con priorità: alta, media, bassa" },
          { text: "Gestione batch: completamento, cancellazione" },
          { text: "Vista scadenza: oggi, settimana, in ritardo" },
          { text: "Completamento e annullamento con un click" },
        ]}
        screenshotContent={
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className={`p-2 rounded text-center text-xs ${i === 3 ? "bg-primary/20 text-primary" : "bg-white/5 text-white/30"}`}>
                  {10 + i}
                </div>
              ))}
            </div>
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              ⚠️ 3 attività in scadenza oggi
            </div>
          </div>
        }
      />

      <TutorialSection
        badge="Tutorial"
        icon={Puzzle}
        title="Estensioni Chrome"
        subtitle="3 estensioni per automazione e raccolta dati"
        description="WCA World, LinkedIn e Report Aziende. Auto-login, scraping directory, download profili e sincronizzazione cookie — tutto automatico."
        features={[
          { text: "WCA: auto-login, scraping directory, download profili" },
          { text: "LinkedIn: sync cookie li_at, estrazione profili" },
          { text: "Report Aziende: scraping prospect con dati finanziari" },
          { text: "Comunicazione bidirezionale webapp ↔ estensione" },
          { text: "Pagine download dedicate con istruzioni" },
        ]}
        screenshotContent={
          <div className="space-y-3">
            {["WCA World", "LinkedIn", "Report Aziende"].map(ext => (
              <div key={ext} className="flex items-center gap-3 p-2 rounded bg-white/5">
                <Chrome className="w-5 h-5 text-primary" />
                <span className="text-sm text-white/60">{ext}</span>
                <span className="ml-auto text-xs text-emerald-400">● Attiva</span>
              </div>
            ))}
          </div>
        }
      />

      <TutorialSection
        badge="Tutorial"
        icon={Settings}
        title="Impostazioni"
        subtitle="Configurazione completa in 9 tab"
        reversed
        description="Tutto il sistema si configura da qui: SMTP, credenziali WCA/LinkedIn, import/export, blacklist, template allegati, profilo AI e abbonamento."
        features={[
          { text: "Email: SMTP con test invio integrato" },
          { text: "Connessioni: WCA + LinkedIn + cookie li_at" },
          { text: "Import/Export: CSV e JSON con selezione campi" },
          { text: "Blacklist: esclusione aziende con sync WCA" },
          { text: "Profilo AI: tono, stile, istruzioni generazione" },
          { text: "Abbonamento: piano attivo, crediti, storico" },
        ]}
        screenshotContent={
          <div className="space-y-2">
            {["Generale", "Email", "Connessioni", "Import/Export", "Blacklist", "Template", "Profilo AI"].map((tab, i) => (
              <div key={tab} className={`px-3 py-1.5 rounded text-xs ${i === 1 ? "bg-primary/10 text-primary" : "bg-white/5 text-white/30"}`}>
                {tab}
              </div>
            ))}
          </div>
        }
      />

      {/* === CHIUSURA === */}
      <ClosingSection />
    </GuidaLayout>
  );
};

export default Guida;

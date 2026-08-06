/**
 * GuidaPage V2 — orchestratore delle tre parti (istituzionale, tutorial, manuale).
 * Contenuti estratti in componenti dedicati per rispettare il budget LOC.
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
import { TutorialChapters } from "@/components/guida/parts/TutorialChapters";
import { ManualChapters } from "@/components/guida/parts/ManualChapters";

const sectionLabels = [
  // === Parte 1: istituzionale ===
  "Copertina",
  "Tagline",
  "La Sfida",
  "Prima/Dopo",
  "Pilastri",
  "Stack",
  "Performance",
  "Impatto",
  "Team AI",
  "Ciclo Decisionale",
  "Ciclo Autonomo",
  "Outreach AI",
  "Rete Globale",
  "Deep Search",
  "Multi-Channel",
  "Prospect",
  "Sicurezza",
  "Risultati",
  "Roadmap",
  // === Parte 2: tutorial operativo ===
  "Guida ai test",
  "1a · Command",
  "1b · Missioni",
  "2a · Esplora",
  "3a · Cockpit",
  "3b · Agenda",
  "3c · Cestinone",
  "4a · Comms",
  "4b · Inbox",
  "4c · Email",
  "4d · Email Intel",
  "4e · Funnemail",
  "4f · Rubriche",
  "5a · Agenti",
  "5b · Intelligence",
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
      {/* === PARTE 1: ISTITUZIONALE === */}
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
      <TutorialChapters />

      {/* === PARTE 3: MANUALE ILLUSTRATO === */}
      <ManualChapters />

      {/* === CHIUSURA === */}
      <ClosingSection />
    </GuidaLayout>
  );
};

export default Guida;

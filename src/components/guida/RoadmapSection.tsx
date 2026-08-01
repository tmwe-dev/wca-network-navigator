import SectionWrapper from "./SectionWrapper";

const roadmap = [
  { quarter: "Q2 2026", items: ["Ricerca autonoma Report Aziende via agente", "Voice AI per chiamate outbound", "Dashboard analytics avanzata"] },
  { quarter: "Q3 2026", items: ["Multi-tenant: più aziende sullo stesso sistema", "Integrazione CRM esterni (Salesforce, HubSpot)", "App mobile per approvazioni on-the-go"] },
  { quarter: "Q4 2026", items: ["Marketplace servizi tra partner", "AI negotiation assistant", "Predictive scoring con ML"] },
];

const RoadmapSection = () => (
  <SectionWrapper className="bg-[#0a0a0f]">
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <span className="text-primary text-sm font-bold tracking-widest uppercase">Roadmap</span>
        <h2 className="text-4xl md:text-5xl font-bold text-white">Cosa arriva dopo</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {roadmap.map((r) => (
          <div key={r.quarter} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
            <h3 className="text-xl font-bold text-primary">{r.quarter}</h3>
            <ul className="space-y-3">
              {r.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/50">
                  <span className="text-primary mt-0.5">◆</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default RoadmapSection;

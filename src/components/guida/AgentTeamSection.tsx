import SectionWrapper from "./SectionWrapper";
import { useQuery } from "@tanstack/react-query";
import { findActiveAgents } from "@/data/agents";

const AgentTeamSection = () => {
  const { data: agents } = useQuery({
    queryKey: ["guida-agents"],
    queryFn: async () => {
      const data = await findActiveAgents("name, role, avatar_emoji, is_active, stats, territory_codes");
      return data || [];
    },
    staleTime: 60000,
  });

  const agentList = agents && agents.length > 0 ? agents : [
    { name: "Sales Agent", role: "outreach", avatar_emoji: "🎯", territory_codes: ["EU"], stats: {} },
    { name: "Support Agent", role: "support", avatar_emoji: "🛡️", territory_codes: ["GLOBAL"], stats: {} },
    { name: "Strategy Agent", role: "strategy", avatar_emoji: "🧠", territory_codes: ["ALL"], stats: {} },
  ];

  return (
    <>
      {/* Agents 1 - Team Overview */}
      <SectionWrapper className="bg-[#0a0a0f]">
        <div className="space-y-12">
          <div className="text-center space-y-4">
            <span className="text-primary text-sm font-bold tracking-widest uppercase">Il Team</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white">Agenti AI Autonomi</h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto">
              Ogni agente ha un ruolo specifico, territori assegnati e obiettivi chiari.
              Lavorano in parallelo, si coordinano e non dormono mai.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {agentList.map((agent: any) => (
              <div key={agent.name} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all group space-y-4 text-center">
                <div className="text-5xl">{agent.avatar_emoji}</div>
                <h3 className="text-xl font-bold text-white">{agent.name}</h3>
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase">
                  {agent.role}
                </span>
                {agent.territory_codes?.length > 0 && (
                  <p className="text-xs text-white/30">
                    Territori: {agent.territory_codes.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </SectionWrapper>

      {/* Agents 2 - How They Work */}
      <SectionWrapper className="bg-[#0b0b12]">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <span className="text-primary text-sm font-bold tracking-widest uppercase">Come funzionano</span>
            <h2 className="text-4xl font-bold text-white">Ciclo decisionale</h2>
            <p className="text-lg text-white/50 leading-relaxed">
              Ogni 10 minuti, il sistema attiva il ciclo autonomo. Ogni agente valuta la propria coda,
              prende decisioni e agisce — o propone azioni per approvazione umana.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { step: "1", title: "Screening", desc: "Analisi messaggi in arrivo: intent, sentiment, priorità" },
              { step: "2", title: "Assegnazione", desc: "L'agente giusto per territorio e competenza" },
              { step: "3", title: "Esecuzione", desc: "Draft email, risposta WhatsApp, o proposta per approvazione" },
              { step: "4", title: "Follow-up", desc: "Reminder automatico +5gg, escalation +7gg se nessuna risposta" },
            ].map((s) => (
              <div key={s.step} className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                  {s.step}
                </div>
                <div>
                  <h4 className="font-bold text-white">{s.title}</h4>
                  <p className="text-sm text-white/40">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionWrapper>
    </>
  );
};

export default AgentTeamSection;

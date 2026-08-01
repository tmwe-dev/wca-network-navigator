import SectionWrapper from "./SectionWrapper";
import { Moon, Clock, Shield, Gauge } from "lucide-react";

const SecuritySection = () => (
  <SectionWrapper className="bg-[#0a0a0f]">
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <span className="text-primary text-sm font-bold tracking-widest uppercase">Sicurezza</span>
        <h2 className="text-4xl md:text-5xl font-bold text-white">Comportamento umano</h2>
        <p className="text-white/40 text-lg">Indistinguibile da un operatore reale — by design</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {[
          {
            icon: Moon, title: "Pausa notturna",
            desc: "Tra mezzanotte e le 6:00 (ora locale del computer) tutte le attività si fermano. Nessun invio, nessuna scansione. Badge 🌙 nell'header con countdown al risveglio."
          },
          {
            icon: Clock, title: "Delay randomizzati",
            desc: "Ogni azione ha un jitter ±15%. WhatsApp: 15-20s tra chat. Email: delay configurabile. LinkedIn: cooldown 5s tra comandi. Mai pattern ripetitivi."
          },
          {
            icon: Gauge, title: "Rate limiting",
            desc: "Max 10 chat WhatsApp per sessione backfill. Max 30 scroll per thread. Batch email con coda programmata. Nessun flood."
          },
          {
            icon: Shield, title: "Approvazione umana",
            desc: "Task ad alto impatto (partner importanti, negoziazioni attive) richiedono approvazione manuale. L'AI propone, l'umano decide."
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="p-6 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
            <Icon className="w-8 h-8 text-primary" />
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default SecuritySection;

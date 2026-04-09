import SectionWrapper from "./SectionWrapper";
import { ArrowRight } from "lucide-react";

const steps = [
  { emoji: "📨", title: "Messaggio in arrivo", desc: "Email, WhatsApp o LinkedIn", color: "from-blue-500/20 to-blue-500/5" },
  { emoji: "🔍", title: "Screening AI", desc: "Intent, sentiment, urgenza", color: "from-violet-500/20 to-violet-500/5" },
  { emoji: "🎯", title: "Assegnazione", desc: "Agente per territorio/competenza", color: "from-primary/20 to-primary/5" },
  { emoji: "📝", title: "Draft risposta", desc: "Generazione AI personalizzata", color: "from-emerald-500/20 to-emerald-500/5" },
  { emoji: "✅", title: "Approvazione", desc: "Auto o manuale per high-stakes", color: "from-amber-500/20 to-amber-500/5" },
  { emoji: "📤", title: "Invio", desc: "Multi-canale con timing naturale", color: "from-red-500/20 to-red-500/5" },
  { emoji: "⏰", title: "Follow-up", desc: "Reminder +5gg, escalation +7gg", color: "from-blue-500/20 to-blue-500/5" },
];

const AutonomousCycleSection = () => (
  <SectionWrapper className="bg-[#0a0a0f]">
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <span className="text-primary text-sm font-bold tracking-widest uppercase">Ciclo Autonomo</span>
        <h2 className="text-4xl md:text-5xl font-bold text-white">Il flusso completo</h2>
        <p className="text-white/40 text-lg">Ogni 10 minuti, automaticamente</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {steps.map((s, i) => (
          <div key={s.title} className="flex items-center gap-4">
            <div className={`p-4 rounded-xl bg-gradient-to-br ${s.color} border border-white/5 text-center w-32 space-y-2`}>
              <div className="text-3xl">{s.emoji}</div>
              <h4 className="text-sm font-bold text-white">{s.title}</h4>
              <p className="text-xs text-white/40">{s.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="w-5 h-5 text-white/20 shrink-0 hidden md:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default AutonomousCycleSection;

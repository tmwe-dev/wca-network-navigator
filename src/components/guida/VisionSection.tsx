import SectionWrapper from "./SectionWrapper";
import { Zap, Brain, Target, TrendingUp, Shield, Clock } from "lucide-react";

const VisionSection = () => (
  <>
    {/* Vision 1 - Before/After */}
    <SectionWrapper className="bg-[#0b0b12]">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <span className="text-primary text-sm font-bold tracking-widest uppercase">La Visione</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white">Da manuale a autonomo</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-4">
            <h3 className="text-xl font-bold text-red-400">❌ Prima</h3>
            <ul className="space-y-3 text-white/50">
              {["Ricerca manuale su directory WCA", "Copia-incolla dati in Excel", "Email generiche a tutti", "Nessun follow-up sistematico", "Lavoro solo in orario ufficio", "Zero personalizzazione"].map((t) => (
                <li key={t} className="flex items-start gap-3"><span className="text-red-400 mt-1">✗</span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="p-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
            <h3 className="text-xl font-bold text-emerald-400">✅ Adesso</h3>
            <ul className="space-y-3 text-white/50">
              {["Scraping automatico directory", "Database centralizzato con enrichment AI", "Email AI personalizzate per partner", "Follow-up automatici multi-canale", "Agenti autonomi 24/7", "Deep profiling con AI"].map((t) => (
                <li key={t} className="flex items-start gap-3"><span className="text-emerald-400 mt-1">✓</span>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </SectionWrapper>

    {/* Vision 2 - Core Pillars */}
    <SectionWrapper className="bg-[#0a0a0f]">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <span className="text-primary text-sm font-bold tracking-widest uppercase">Fondamenta</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white">6 pilastri tecnologici</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Brain, title: "AI Agents", desc: "Team di agenti autonomi che lavorano in parallelo, ognuno con competenze specifiche" },
            { icon: Target, title: "Deep Search", desc: "Arricchimento automatico: siti web, social, servizi, logo — tutto scoperto dall'AI" },
            { icon: Zap, title: "Multi-Channel", desc: "Email, WhatsApp, LinkedIn — comunicazione unificata su tutti i canali" },
            { icon: TrendingUp, title: "Smart Outreach", desc: "Email generate dall'AI, personalizzate per ogni partner, con variabili dinamiche" },
            { icon: Shield, title: "Human Behavior", desc: "Delay randomizzati, pausa notturna, rate limiting — comportamento indistinguibile dall'umano" },
            { icon: Clock, title: "24/7 Autonomy", desc: "Ciclo autonomo ogni 10 minuti: screening, assegnazione, esecuzione, follow-up" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all group space-y-3">
              <Icon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>

    {/* Vision 3 - The Stack */}
    <SectionWrapper className="bg-[#0b0b12]">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <span className="text-primary text-sm font-bold tracking-widest uppercase">Architettura</span>
          <h2 className="text-4xl font-bold text-white">Stack tecnologico</h2>
          <p className="text-lg text-white/50 leading-relaxed">
            Costruito su tecnologie enterprise-grade con un'architettura modulare che scala con il business.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { layer: "Frontend", tech: "React 18 + TypeScript + Tailwind CSS", color: "from-blue-500/20 to-blue-500/5" },
            { layer: "State", tech: "TanStack Query + Supabase Realtime", color: "from-violet-500/20 to-violet-500/5" },
            { layer: "Backend", tech: "Supabase Edge Functions + PostgreSQL", color: "from-emerald-500/20 to-emerald-500/5" },
            { layer: "AI Engine", tech: "GPT-5 + Gemini 2.5 Pro via Gateway", color: "from-amber-500/20 to-amber-500/5" },
            { layer: "Automation", tech: "Chrome Extensions × 3 + pg_cron", color: "from-red-500/20 to-red-500/5" },
            { layer: "Channels", tech: "SMTP/IMAP + WhatsApp Web + LinkedIn", color: "from-primary/20 to-primary/5" },
          ].map((s) => (
            <div key={s.layer} className={`p-4 rounded-lg bg-gradient-to-r ${s.color} border border-white/5`}>
              <span className="text-xs text-white/40 uppercase tracking-wider">{s.layer}</span>
              <p className="text-white font-medium mt-1">{s.tech}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  </>
);

export default VisionSection;

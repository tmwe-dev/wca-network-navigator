import SectionWrapper from "./SectionWrapper";
import { Globe, ArrowDown } from "lucide-react";

const CoverSection = () => (
  <>
    {/* Cover 1 - Hero */}
    <SectionWrapper className="bg-[#0a0a0f]">
      <div className="flex flex-col items-center justify-center text-center min-h-[80vh] relative">
        {/* Glow effect */}
        <div className="absolute w-[600px] h-[600px] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
        
        <div className="relative z-10 space-y-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <Globe className="w-16 h-16 text-primary animate-[spin_20s_linear_infinite]" />
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight text-white leading-none">
            WCA Network
            <span className="block bg-gradient-to-r from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent">
              Navigator
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            Il primo ufficio commerciale completamente autonomo.
            <br />
            Powered by AI Agents.
          </p>
          <div className="flex items-center gap-6 justify-center mt-12">
            <div className="px-6 py-2 rounded-full border border-primary/30 text-primary text-sm font-medium">
              v4.0 — Autonomous Edition
            </div>
          </div>
          <div className="mt-16 animate-bounce">
            <ArrowDown className="w-6 h-6 text-white/30 mx-auto" />
          </div>
        </div>
      </div>
    </SectionWrapper>

    {/* Cover 2 - Tagline */}
    <SectionWrapper className="bg-[#0a0a0f]">
      <div className="flex flex-col items-center justify-center text-center min-h-[60vh]">
        <p className="text-3xl md:text-5xl font-light text-white/80 leading-relaxed max-w-4xl">
          "Un sistema che <span className="text-primary font-semibold">trova clienti</span>,
          <span className="text-blue-400 font-semibold"> li contatta</span>,
          <span className="text-violet-400 font-semibold"> risponde ai messaggi</span> e
          <span className="text-emerald-400 font-semibold"> gestisce i follow-up</span>.
          <br />
          <span className="text-white/40 text-2xl md:text-3xl mt-4 block">Mentre tu dormi.</span>"
        </p>
      </div>
    </SectionWrapper>

    {/* Cover 3 - The Challenge */}
    <SectionWrapper className="bg-[#0a0a0f]">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <span className="text-primary text-sm font-bold tracking-widest uppercase">La Sfida</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Un mercato globale.
            <br />
            <span className="text-white/40">Un team di 3 persone.</span>
          </h2>
          <p className="text-lg text-white/50 leading-relaxed">
            Migliaia di potenziali partner in 190+ paesi. Directory da scansionare, profili da scaricare,
            email da personalizzare, follow-up da tracciare. Un lavoro impossibile con metodi tradizionali.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { n: "12,000+", label: "Partner nel database" },
            { n: "190+", label: "Paesi coperti" },
            { n: "50,000+", label: "Email inviate" },
            { n: "24/7", label: "Operatività autonoma" },
          ].map((s) => (
            <div key={s.label} className="flex items-baseline gap-4 border-l-2 border-primary/30 pl-6 py-2">
              <span className="text-4xl font-black text-white">{s.n}</span>
              <span className="text-white/40">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  </>
);

export default CoverSection;

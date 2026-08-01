import SectionWrapper from "./SectionWrapper";
import { TrendingUp, CheckCircle, Zap, Clock } from "lucide-react";

const ResultsSection = () => (
  <SectionWrapper className="bg-[#0b0b12]">
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <span className="text-primary text-sm font-bold tracking-widest uppercase">Risultati</span>
        <h2 className="text-4xl md:text-5xl font-bold text-white">Obiettivi raggiunti</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        {[
          { icon: TrendingUp, title: "Scala globale senza team", desc: "Copertura di 190+ paesi con un team di 3 persone + agenti AI. Impossibile con metodi tradizionali." },
          { icon: CheckCircle, title: "Follow-up al 100%", desc: "Nessun contatto viene dimenticato. Il sistema traccia ogni interazione e programma automaticamente il prossimo passo." },
          { icon: Zap, title: "Velocità di risposta", desc: "Le risposte ai messaggi vengono preparate in minuti, non in giorni. L'AI analizza il contesto e genera draft personalizzati." },
          { icon: Clock, title: "Operatività 24/7", desc: "Il sistema lavora anche di notte (email via cron server-side), mentre gli agenti riposano durante la pausa notturna per i canali sensibili." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-4 p-6 rounded-xl bg-white/[0.02] border border-white/5">
            <Icon className="w-8 h-8 text-primary shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-sm text-white/40 leading-relaxed mt-1">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default ResultsSection;

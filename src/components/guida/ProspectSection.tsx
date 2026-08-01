import SectionWrapper from "./SectionWrapper";
import { Building2, Upload, Filter, BarChart3 } from "lucide-react";

const ProspectSection = () => (
  <SectionWrapper className="bg-[#0b0b12]">
    <div className="grid md:grid-cols-2 gap-16 items-center">
      <div className="space-y-6">
        <span className="text-primary text-sm font-bold tracking-widest uppercase">Prospect Center</span>
        <h2 className="text-4xl font-bold text-white">Discovery autonomo</h2>
        <p className="text-lg text-white/50 leading-relaxed">
          Importazione automatica di prospect italiani da Report Aziende.
          L'agente naviga il portale, estrae dati finanziari completi e li inserisce nel sistema.
        </p>
        <div className="space-y-3">
          {[
            { icon: Upload, text: "Importazione tramite estensione Chrome dedicata" },
            { icon: Filter, text: "Filtri: fatturato, dipendenti, ATECO, regione" },
            { icon: BarChart3, text: "Ranking automatico per rilevanza settoriale" },
            { icon: Building2, text: "Dettaglio completo: finanziari, contatti, social" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-white/50">
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
        <h4 className="text-lg font-bold text-white">🏭 Griglia ATECO</h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { code: "52.29", label: "Spedizionieri", rank: "A+" },
            { code: "49.41", label: "Trasporto merci", rank: "A" },
            { code: "52.24", label: "Movimentazione", rank: "B+" },
            { code: "52.10", label: "Magazzinaggio", rank: "B" },
          ].map((a) => (
            <div key={a.code} className="p-3 rounded-lg bg-white/5 border border-white/5">
              <span className="text-xs text-white/30">{a.code}</span>
              <p className="text-sm text-white font-medium">{a.label}</p>
              <span className="text-xs text-primary font-bold">{a.rank}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </SectionWrapper>
);

export default ProspectSection;

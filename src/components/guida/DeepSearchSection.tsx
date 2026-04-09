import SectionWrapper from "./SectionWrapper";
import { Search, Globe, FileText, Brain, Image, MessageCircle, Linkedin } from "lucide-react";

const steps = [
  { icon: Search, title: "Scoperta Sito Web", desc: "Estrazione dominio dall'email aziendale o ricerca via Partner Connect" },
  { icon: FileText, title: "Scraping Contenuti", desc: "About, servizi, contatti — estratti automaticamente dal sito" },
  { icon: Brain, title: "Analisi AI", desc: "Descrizione, punti chiave, servizi elaborati dall'intelligenza artificiale" },
  { icon: Image, title: "Logo Automatico", desc: "Favicon via Google Favicon API — solo originale, mai inventato" },
  { icon: MessageCircle, title: "Link WhatsApp", desc: "Generazione automatica wa.me dal numero di telefono" },
  { icon: Linkedin, title: "Social Discovery", desc: "LinkedIn, Facebook, Instagram, Twitter — trovati automaticamente" },
];

const DeepSearchSection = () => (
  <>
    <SectionWrapper className="bg-[#0b0b12]">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <span className="text-primary text-sm font-bold tracking-widest uppercase">Deep Search</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white">Arricchimento intelligente</h2>
          <p className="text-white/40 text-lg max-w-2xl mx-auto">
            Da un semplice nome azienda a un profilo completo con sito, logo, social, servizi e descrizione AI.
            Singolo o bulk su centinaia di partner.
          </p>
        </div>
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 hidden md:block" />
          <div className="space-y-6">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className={`flex items-center gap-8 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
                <div className={`flex-1 p-6 rounded-xl bg-white/[0.02] border border-white/5 ${i % 2 === 0 ? "md:text-right" : ""}`}>
                  <h4 className="font-bold text-white">{title}</h4>
                  <p className="text-sm text-white/40 mt-1">{desc}</p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/20 shrink-0 z-10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  </>
);

export default DeepSearchSection;

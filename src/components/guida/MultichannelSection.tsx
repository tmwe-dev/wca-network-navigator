import SectionWrapper from "./SectionWrapper";
import { Mail, MessageCircle, Linkedin, ArrowRightLeft } from "lucide-react";

const MultichannelSection = () => (
  <SectionWrapper className="bg-[#0a0a0f]">
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <span className="text-primary text-sm font-bold tracking-widest uppercase">Multi-Channel</span>
        <h2 className="text-4xl md:text-5xl font-bold text-white">3 canali, 1 sistema</h2>
        <p className="text-white/40 text-lg">Comunicazione unificata su email, WhatsApp e LinkedIn</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {[
          {
            icon: Mail, name: "Email", color: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/20",
            features: ["SMTP/IMAP bidirezionale", "Sync automatico ogni 2 min", "Cron server-side 24/7", "Tracking aperture", "Allegati e template"]
          },
          {
            icon: MessageCircle, name: "WhatsApp", color: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/20",
            features: ["Scansione ogni 75 secondi", "Backfill intelligente", "Max 10 chat/sessione", "Delay 15-20s tra chat", "Pausa notturna automatica"]
          },
          {
            icon: Linkedin, name: "LinkedIn", color: "from-blue-600/20 to-blue-600/5", border: "border-blue-600/20",
            features: ["Inbox reading automatico", "Navigazione a /messaging/", "Selettori aggiornati 2026", "Cookie sync li_at", "Diagnostica DOM integrata"]
          },
        ].map(({ icon: Icon, name, color, border, features }) => (
          <div key={name} className={`p-6 rounded-2xl bg-gradient-to-b ${color} border ${border} space-y-4`}>
            <div className="flex items-center gap-3">
              <Icon className="w-8 h-8 text-white" />
              <h3 className="text-xl font-bold text-white">{name}</h3>
            </div>
            <ul className="space-y-2">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-white/50">
                  <ArrowRightLeft className="w-3 h-3 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </SectionWrapper>
);

export default MultichannelSection;

import SectionWrapper from "./SectionWrapper";
import { Globe } from "lucide-react";

const ClosingSection = () => (
  <SectionWrapper className="bg-[#0a0a0f]">
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh] relative">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="relative z-10 space-y-8">
        <Globe className="w-20 h-20 text-primary mx-auto opacity-50" />
        <h2 className="text-4xl md:text-6xl font-black text-white leading-tight">
          Il futuro del
          <span className="block bg-gradient-to-r from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent">
            business development
          </span>
          è adesso.
        </h2>
        <p className="text-xl text-white/40 max-w-xl mx-auto">
          WCA Network Navigator — dove l'intelligenza artificiale incontra il commercio internazionale.
        </p>
        <div className="pt-8 text-white/20 text-sm">
          Built with ❤️ and AI · 2026
        </div>
      </div>
    </div>
  </SectionWrapper>
);

export default ClosingSection;

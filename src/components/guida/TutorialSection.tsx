import SectionWrapper from "./SectionWrapper";
import ScreenshotFrame from "./ScreenshotFrame";
import { LucideIcon } from "lucide-react";

interface TutorialFeature {
  text: string;
}

interface TutorialSectionProps {
  badge: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  features: TutorialFeature[];
  screenshotContent: React.ReactNode;
  reversed?: boolean;
}

const TutorialSection = ({
  badge, icon: Icon, title, subtitle, description, features, screenshotContent, reversed = false,
}: TutorialSectionProps) => (
  <SectionWrapper className="bg-[#0a0a0f]">
    <div className={`grid md:grid-cols-2 gap-12 items-center ${reversed ? "direction-rtl" : ""}`}>
      <div className={`space-y-6 ${reversed ? "md:order-2" : ""}`} style={{ direction: "ltr" }}>
        <span className="text-primary text-sm font-bold tracking-widest uppercase">{badge}</span>
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8 text-primary" />
          <h2 className="text-3xl font-bold text-white">{title}</h2>
        </div>
        <p className="text-lg text-white/40">{subtitle}</p>
        <p className="text-white/50 leading-relaxed">{description}</p>
        <ul className="space-y-2">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/50">
              <span className="text-primary mt-0.5">•</span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={reversed ? "md:order-1" : ""} style={{ direction: "ltr" }}>
        <ScreenshotFrame title={title}>
          <div className="p-6 min-h-[280px]">
            {screenshotContent}
          </div>
        </ScreenshotFrame>
      </div>
    </div>
  </SectionWrapper>
);

export default TutorialSection;

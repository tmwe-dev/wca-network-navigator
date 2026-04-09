import { useRef, useState, useEffect, ReactNode } from "react";
import ScrollIndicator from "./ScrollIndicator";

interface GuidaLayoutProps {
  children: ReactNode;
  sectionLabels: string[];
}

const GuidaLayout = ({ children, sectionLabels }: GuidaLayoutProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight - container.clientHeight;
      const p = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setProgress(p);

      const sections = container.querySelectorAll("[data-section]");
      let closest = 0;
      let minDist = Infinity;
      sections.forEach((s, i) => {
        const rect = s.getBoundingClientRect();
        const dist = Math.abs(rect.top - container.getBoundingClientRect().top);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setActiveIndex(closest);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const sections = container.querySelectorAll("[data-section]");
    sections[index]?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f]">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-primary via-blue-400 to-violet-500 transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Nav dots */}
      <ScrollIndicator
        labels={sectionLabels}
        activeIndex={activeIndex}
        onNavigate={scrollToSection}
      />

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scroll-smooth"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {children}
      </div>
    </div>
  );
};

export default GuidaLayout;

import { useState } from "react";

interface ScrollIndicatorProps {
  labels: string[];
  activeIndex: number;
  onNavigate: (index: number) => void;
}

const ScrollIndicator = ({ labels, activeIndex, onNavigate }: ScrollIndicatorProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[60] flex flex-col gap-2 items-end">
      {labels.map((label, i) => (
        <button
          key={i}
          onClick={() => onNavigate(i)}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          className="group flex items-center gap-2 transition-all"
        >
          {(hoveredIndex === i) && (
            <span className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm whitespace-nowrap animate-fade-in">
              {label}
            </span>
          )}
          <span
            className={`block rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-3 h-3 bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                : "w-2 h-2 bg-white/30 hover:bg-white/60"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default ScrollIndicator;

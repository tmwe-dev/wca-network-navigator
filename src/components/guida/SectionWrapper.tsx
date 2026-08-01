import { ReactNode, useRef, useEffect, useState } from "react";

interface SectionWrapperProps {
  children: ReactNode;
  className?: string;
  gradient?: string;
}

const SectionWrapper = ({ children, className = "", gradient }: SectionWrapperProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-section
      className={`min-h-screen w-full flex items-center justify-center relative overflow-hidden ${className}`}
      style={{ scrollSnapAlign: "start", background: gradient }}
    >
      <div className={`w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-20 transition-all duration-1000 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        {children}
      </div>
    </div>
  );
};

export default SectionWrapper;

import { useEffect, useState } from "react";
import type { CanvasData } from "../PartnerCanvas";

export function usePartnerCanvas(data: CanvasData | null) {
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVisibleSections(new Set());
    if (!data) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const sections = ["header", "contacts", "services", "markets", "corporate", "networks", "linkedin"];
    sections.forEach((section, i) => {
      timers.push(setTimeout(() => {
        setVisibleSections((prev) => new Set(prev).add(section));
      }, 200 + i * 300));
    });

    return () => timers.forEach(clearTimeout);
  }, [data?.company_name]);

  const show = (s: string) => visibleSections.has(s);

  return { show };
}

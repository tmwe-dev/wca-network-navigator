/**
 * HighlightOverlay — disegna un alone pulsante attorno a un elemento DOM
 * indicato dal Co-Pilot. Si autoricalcola al resize/scroll e svanisce dopo
 * `durationMs` (default 4000).
 */
import { useEffect, useState } from "react";

export interface HighlightTarget {
  selector?: string;
  text?: string; // fallback: cerca per testo visibile
  hint?: string;
  durationMs?: number;
}

interface Rect { top: number; left: number; width: number; height: number; }

function findElement(t: HighlightTarget): Element | null {
  if (t.selector) {
    try {
      const el = document.querySelector(t.selector);
      if (el) return el;
    } catch { /* invalid selector */ }
  }
  if (t.text) {
    const needle = t.text.toLowerCase().trim();
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button'], [data-copilot-id]"));
    for (const c of candidates) {
      const txt = (c.innerText || c.textContent || "").toLowerCase().trim();
      if (txt && (txt === needle || txt.includes(needle))) return c;
    }
  }
  return null;
}

export function HighlightOverlay({ target, onDone }: { target: HighlightTarget; onDone: () => void }) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    let cancelled = false;
    const recompute = () => {
      const el = findElement(target);
      if (!el || cancelled) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      try { (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" }); } catch { /* noop */ }
    };
    recompute();
    const t = window.setInterval(recompute, 250);
    const timeout = window.setTimeout(() => { cancelled = true; window.clearInterval(t); onDone(); }, target.durationMs ?? 4000);
    window.addEventListener("resize", recompute);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", recompute);
    };
  }, [target, onDone]);

  if (!rect) return null;

  return (
    <div
      className="pointer-events-none fixed z-[9998] rounded-lg ring-4 ring-primary animate-pulse"
      style={{
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        boxShadow: "0 0 0 9999px hsl(var(--background) / 0.35)",
      }}
    >
      {target.hint && (
        <div className="absolute -top-9 left-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-lg">
          {target.hint}
        </div>
      )}
    </div>
  );
}
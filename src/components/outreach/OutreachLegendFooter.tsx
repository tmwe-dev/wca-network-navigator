/**
 * OutreachLegendFooter — Legenda compatta dei badge "sorgente" usati in Outreach.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const LEGEND: ReadonlyArray<{ readonly label: string; readonly color: string; readonly desc: string }> = [
  { label: "Manuale", color: "bg-muted text-muted-foreground", desc: "Creato a mano" },
  { label: "AI", color: "bg-primary/15 text-primary", desc: "Bozza generata da agente AI" },
  { label: "Campagna", color: "bg-blue-500/15 text-blue-400", desc: "Invio massivo campagna" },
  { label: "Missione", color: "bg-amber-500/15 text-amber-500", desc: "Step di una missione AI" },
  { label: "Sequenza", color: "bg-purple-500/15 text-purple-400", desc: "Step di una cadenza multi-touch" },
];

export function OutreachLegendFooter() {
  // Default: nascosto. L'utente lo riapre esplicitamente settando "0".
  const [hidden, setHidden] = useState<boolean>(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem("outreach-legend-hidden");
      // Solo se l'utente ha esplicitamente messo "0" la mostriamo
      setHidden(v !== "0");
    } catch { /* ignore */ }
  }, []);
  if (hidden) return null;
  const close = () => {
    try { localStorage.setItem("outreach-legend-hidden", "1"); } catch { /* ignore */ }
    setHidden(true);
  };
  return (
    <div className="shrink-0 border-t border-border/30 px-3 py-1.5 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground bg-muted/10">
      <span className="font-semibold uppercase text-[9px] tracking-wide">Legenda sorgenti</span>
      {LEGEND.map((l) => (
        <span key={l.label} className="inline-flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${l.color}`}>{l.label}</span>
          <span>{l.desc}</span>
        </span>
      ))}
      <button
        type="button"
        aria-label="Nascondi legenda"
        onClick={close}
        className="ml-auto text-muted-foreground/60 hover:text-foreground p-0.5 rounded"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
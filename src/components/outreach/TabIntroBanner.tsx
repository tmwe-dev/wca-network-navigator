/**
 * TabIntroBanner — Banda esplicativa riusabile in cima a ogni tab Outreach.
 * Spiega in una frase: cos'è, da dove arriva il dato, cosa puoi fare.
 */
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabIntroBannerProps {
  readonly id: string; // chiave per memorizzare la chiusura
  readonly icon: LucideIcon;
  readonly title: string;
  readonly purpose: string;
  readonly origin?: string;
  readonly actions?: string;
  readonly relatedLink?: { readonly label: string; readonly onClick: () => void };
  readonly tone?: "neutral" | "primary" | "amber" | "emerald";
}

const TONES: Record<NonNullable<TabIntroBannerProps["tone"]>, string> = {
  neutral: "bg-muted/30 border-border/40 text-muted-foreground",
  primary: "bg-primary/5 border-primary/20 text-foreground",
  amber: "bg-amber-500/5 border-amber-500/20 text-foreground",
  emerald: "bg-emerald-500/5 border-emerald-500/20 text-foreground",
};

export function TabIntroBanner({ id, icon: Icon, title, purpose, origin, actions, relatedLink, tone = "neutral" }: TabIntroBannerProps) {
  const storageKey = `outreach-intro-${id}`;
  const [hidden, setHidden] = useState<boolean>(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(storageKey) === "1");
    } catch { /* ignore */ }
  }, [storageKey]);

  if (hidden) return null;

  const handleClose = () => {
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    setHidden(true);
  };

  return (
    <div className={cn("shrink-0 mx-3 mt-2 mb-1 rounded-md border px-3 py-2 flex items-start gap-2.5", TONES[tone])}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
      <div className="flex-1 min-w-0 text-[11px] leading-relaxed">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{title}</span>
          <span className="text-muted-foreground">·</span>
          <span>{purpose}</span>
        </div>
        {(origin || actions) && (
          <div className="mt-0.5 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
            {origin && (
              <span className="inline-flex items-center gap-1">
                <Info className="w-2.5 h-2.5" /> Origine: {origin}
              </span>
            )}
            {actions && <span>Puoi: {actions}</span>}
            {relatedLink && (
              <button
                type="button"
                onClick={relatedLink.onClick}
                className="text-primary hover:underline font-medium"
              >
                → {relatedLink.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Nascondi"
        onClick={handleClose}
        className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
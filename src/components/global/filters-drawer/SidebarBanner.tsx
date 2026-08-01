/**
 * SidebarBanner — banner contestuale standardizzato in cima a OGNI sidebar
 * filtri. Identifica chiaramente l'area in cui l'utente sta operando con
 * icona, titolo e una breve descrizione di una riga.
 *
 * Adottato sia da `FiltersDrawer` (sheet a scomparsa) sia da
 * `ContextFiltersRail` (linguetta laterale) per look uniforme.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SidebarBannerProps {
  icon: React.ElementType;
  title: string;
  description: string;
  /** Tono visivo (default = primary). Usa "info" per CRM/contatti, "accent" per AI lab. */
  tone?: "primary" | "info" | "accent";
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<SidebarBannerProps["tone"]>, string> = {
  primary: "border-primary/30 bg-primary/[0.07] text-primary",
  info: "border-sky-500/30 bg-sky-500/[0.07] text-sky-400",
  accent: "border-violet-500/30 bg-violet-500/[0.07] text-violet-400",
};

export function SidebarBanner({
  icon: Icon,
  title,
  description,
  tone = "primary",
  className,
}: SidebarBannerProps) {
  return (
    <section
      className={cn(
        "rounded-lg border px-3 py-2.5 mb-1",
        TONE_CLASSES[tone],
        className,
      )}
      aria-label={`Contesto: ${title}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 mt-0.5">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-foreground leading-tight">
            {title}
          </h4>
          <p className="text-[10.5px] text-muted-foreground leading-snug mt-0.5">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
/**
 * LabGuideHeader — header didattico riutilizzabile per le pagine del Lab.
 * Mostra titolo + sottotitolo + 3 passi numerati. Solo presentazione,
 * nessuna logica.
 */
import * as React from "react";

export interface LabGuideStep {
  readonly label: string;
}

export interface LabGuideHeaderProps {
  readonly title: string;
  readonly subtitle: string;
  readonly steps: readonly [LabGuideStep, LabGuideStep, LabGuideStep];
  readonly right?: React.ReactNode;
}

export function LabGuideHeader({
  title, subtitle, steps, right,
}: LabGuideHeaderProps): React.ReactElement {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-foreground/70">{subtitle}</p>
        <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/65">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <span className="text-foreground/30">→</span> : null}
              <li className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                {s.label}
              </li>
            </React.Fragment>
          ))}
        </ol>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </header>
  );
}

export default LabGuideHeader;
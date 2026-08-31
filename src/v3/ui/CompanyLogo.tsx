/**
 * Logo azienda standard V3.
 *
 * Se il dominio è noto (sito o dominio email non generico) mostra il logo
 * reale; altrimenti ripiega sulle iniziali, mantenendo sempre lo stesso
 * ingombro così le righe restano allineate.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface CompanyLogoProps {
  readonly dominio?: string | null;
  readonly nome?: string | null;
  readonly className?: string;
}

function iniziali(nome: string | null | undefined): string {
  if (!nome) return "—";
  const parti = nome
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parti.length === 0) return "—";
  return (parti[0]![0]! + (parti[1]?.[0] ?? "")).toUpperCase();
}

export function CompanyLogo({ dominio, nome, className }: CompanyLogoProps): React.ReactElement {
  const [fallito, setFallito] = React.useState(false);
  const pulito = dominio?.trim().toLowerCase().replace(/^www\./, "") || null;
  const mostraLogo = Boolean(pulito) && !fallito;

  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {mostraLogo ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(pulito!)}&sz=64`}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setFallito(true)}
        />
      ) : (
        iniziali(nome)
      )}
    </span>
  );
}

export default CompanyLogo;

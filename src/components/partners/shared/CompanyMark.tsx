/**
 * CompanyMark — logo aziendale con ingombro fisso.
 * Mostra il logo salvato; in mancanza usa la favicon del dominio del sito
 * (solo se il sito esiste), altrimenti le iniziali.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface CompanyMarkProps {
  readonly logoUrl?: string | null;
  readonly website?: string | null;
  readonly name?: string | null;
  readonly className?: string;
}

function initials(name?: string | null): string {
  if (!name) return "—";
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "—";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

function domainOf(website?: string | null): string | null {
  const raw = website?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function CompanyMark({ logoUrl, website, name, className }: CompanyMarkProps): React.ReactElement {
  const [failed, setFailed] = React.useState(false);
  const domain = domainOf(website);
  const src = logoUrl?.trim()
    ? logoUrl.trim()
    : domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
      : null;
  const showImage = !!src && !failed;

  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {showImage ? (
        <img src={src!} alt="" loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export default CompanyMark;

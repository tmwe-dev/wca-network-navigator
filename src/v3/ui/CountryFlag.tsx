/**
 * Bandiera paese standard V3.
 *
 * Immagine reale (non emoji: su molti sistemi le emoji-bandiera non esistono),
 * ingombro fisso 18×13 così le colonne restano allineate.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { iso2Paese } from "./paese";

export function CountryFlag({
  paese,
  className,
}: {
  readonly paese?: string | null;
  readonly className?: string;
}): React.ReactElement {
  const iso = iso2Paese(paese);
  if (!iso) {
    return <span aria-hidden className={cn("inline-block h-[13px] w-[18px] rounded-[2px] border border-border bg-muted/40", className)} />;
  }
  return (
    <img
      src={`https://flagcdn.com/36x27/${iso.toLowerCase()}.png`}
      alt=""
      aria-hidden
      loading="lazy"
      className={cn("inline-block h-[13px] w-[18px] shrink-0 rounded-[2px] border border-border object-cover", className)}
    />
  );
}

export default CountryFlag;

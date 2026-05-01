/**
 * EntityRowFlag — bandiera grande con codice paese sotto.
 *
 * Atom condiviso usato dalle viste "Classica" (Contatti CRM, WCA Partner)
 * per uniformare lo stile delle BCA card: una sola bandiera, dimensione 2x,
 * con il codice ISO sotto.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";

export interface EntityRowFlagProps {
  countryCode?: string | null;
  /** Etichetta visibile sotto (di default: codice ISO upper). */
  label?: string | null;
  size?: "md" | "lg";
  className?: string;
}

export function EntityRowFlag({
  countryCode,
  label,
  size = "lg",
  className,
}: EntityRowFlagProps): React.ReactElement {
  const code = (countryCode || "").trim();
  const flag = code ? countryCodeToFlag(code) : "";
  const text = (label ?? code).toUpperCase().slice(0, 3);
  const flagSize = size === "lg" ? "text-[26px]" : "text-lg";
  // Mai mostrare il "mondino" 🌐: se manca il codice paese rendiamo un
  // placeholder neutro così la card resta pulita.
  const hasFlag = !!flag;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center leading-none select-none",
        className
      )}
      aria-label={code || "Paese sconosciuto"}
    >
      {hasFlag ? (
        <span className={cn(flagSize, "leading-none")}>{flag}</span>
      ) : (
        <span
          className={cn(
            flagSize,
            "leading-none text-muted-foreground/30 font-light"
          )}
          aria-hidden
        >
          ·
        </span>
      )}
      {hasFlag && text && (
        <span className="text-[8px] text-muted-foreground/80 font-semibold tracking-wide mt-0.5">
          {text}
        </span>
      )}
    </div>
  );
}

export default EntityRowFlag;
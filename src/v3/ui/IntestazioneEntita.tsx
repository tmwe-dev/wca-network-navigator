/**
 * Intestazione di entità — standard V3 per ogni maschera di dettaglio.
 *
 * Regola: l'utente non deve mai avere dubbi su CHI sta guardando.
 * Perciò l'identità sta in alto, sempre nella stessa forma:
 *
 *   [logo azienda]  Nome contatto            [badge di stato]
 *                   ruolo · azienda · 🏳 città, paese
 *
 * L'azienda non va mai messa tra parentesi accanto al nome: sta qui, con
 * il suo logo, la bandiera del paese e la città.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "./CompanyLogo";
import { CountryFlag } from "./CountryFlag";

const DOMINI_GENERICI = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.it",
  "outlook.com",
  "outlook.it",
  "live.com",
  "live.it",
  "yahoo.com",
  "yahoo.it",
  "libero.it",
  "icloud.com",
  "me.com",
  "pec.it",
  "tiscali.it",
  "alice.it",
  "virgilio.it",
  "aol.com",
  "protonmail.com",
  "qq.com",
  "163.com",
]);

/** Dominio aziendale utile per il logo: sito se c'è, altrimenti email non generica. */
export function dominioAziendale(email?: string | null, sito?: string | null): string | null {
  const daSito = sito
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  if (daSito) return daSito;

  const daEmail = email?.trim().toLowerCase().split("@")[1];
  if (!daEmail || DOMINI_GENERICI.has(daEmail)) return null;
  return daEmail;
}

export interface IntestazioneEntitaProps {
  /** Nome della persona o dell'entità principale. */
  readonly nome: string;
  /** Ruolo/posizione, se noto. */
  readonly ruolo?: string | null;
  readonly azienda?: string | null;
  readonly citta?: string | null;
  readonly paese?: string | null;
  /** Dominio per il logo; se assente si ricava da email/sito. */
  readonly dominio?: string | null;
  readonly email?: string | null;
  readonly sito?: string | null;
  /** Badge di stato allineati a destra (stato circuito, interazioni, ecc.). */
  readonly badge?: React.ReactNode;
  /** Azioni primarie della scheda (massimo due). */
  readonly azioni?: React.ReactNode;
  readonly className?: string;
}

export function IntestazioneEntita({
  nome,
  ruolo,
  azienda,
  citta,
  paese,
  dominio,
  email,
  sito,
  badge,
  azioni,
  className,
}: IntestazioneEntitaProps): React.ReactElement {
  const dominioLogo = dominio ?? dominioAziendale(email, sito);
  const luogo = [citta, paese].filter(Boolean).join(", ");

  return (
    <header
      className={cn(
        "v3-glass flex flex-wrap items-start gap-3 rounded-lg p-4 text-left",
        className,
      )}
    >
      <CompanyLogo dominio={dominioLogo} nome={azienda ?? nome} className="h-11 w-11 rounded-lg" />

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold leading-tight text-foreground">{nome}</h2>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {ruolo && <span className="truncate">{ruolo}</span>}
          {ruolo && azienda && <span aria-hidden>·</span>}
          {azienda && <span className="truncate font-medium text-foreground">{azienda}</span>}
          {(citta || paese) && (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5">
                <CountryFlag paese={paese} />
                <span className="truncate">{luogo}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {badge && <div className="flex flex-wrap items-center gap-1.5">{badge}</div>}
      {azioni && <div className="flex items-center gap-1.5">{azioni}</div>}
    </header>
  );
}

export default IntestazioneEntita;

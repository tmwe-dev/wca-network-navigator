/**
 * BlacklistStaleBanner — Banner globale (solo desktop, top di pagina) che
 * avvisa quando la blacklist non viene aggiornata da oltre 30 giorni.
 * Si nasconde da solo se non c'è dato di sync o se è recente.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useBlacklistStats } from "@/hooks/useBlacklist";

const REFRESH_DAYS = 30;

export function BlacklistStaleBanner(): React.ReactElement | null {
  const { data: stats } = useBlacklistStats();
  const lastUpdated = stats?.lastUpdated ?? null;
  const days = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86400000)
    : null;

  // Se non c'è ancora alcun import e non abbiamo voci, non mostrare nulla
  // (evita rumore su workspace vuoti / nuovi). Se invece esistono già voci ma
  // nessun log, lo mostriamo come "mai loggato".
  const hasEntries = (stats?.total ?? 0) > 0;
  const isOverdue = days !== null && days >= REFRESH_DAYS;
  const isMissing = days === null && hasEntries;

  if (!isOverdue && !isMissing) return null;

  return (
    <div
      role="alert"
      className="hidden md:flex items-center justify-between gap-3 px-4 py-1.5 bg-destructive/10 border-b border-destructive/30 text-destructive text-xs"
    >
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">
          {isMissing
            ? "Blacklist mai aggiornata."
            : `Blacklist non aggiornata da ${days} giorni (limite ${REFRESH_DAYS}g).`}
          {" "}Carica il file più recente esportato da WCA World.
        </span>
      </div>
      <Link
        to="/v2/settings?tab=connessioni"
        className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md bg-destructive/20 hover:bg-destructive/30 font-medium transition-colors"
      >
        Aggiorna ora →
      </Link>
    </div>
  );
}

export default BlacklistStaleBanner;
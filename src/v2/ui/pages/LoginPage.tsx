/**
 * LoginPage — Real login form using useAuthV2
 *
 * AUDIT FIX AUTH-1: Replaces the stub that caused an infinite redirect loop
 * (/auth → /v2/login → /auth). Now renders email+password form with
 * whitelist check, signup toggle, and reset-password link.
 */
import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { Loader2, Plane } from "lucide-react";
import { tmweLoginStart } from "@/data/tmwe";

const REASON_MESSAGES: Record<string, string> = {
  not_whitelisted: "Email non autorizzata. Contatta l'amministratore per essere aggiunto alla lista operatori.",
  no_tmwe_email: "L'account TMWE non espone un'email. Impossibile procedere.",
  user_create_failed: "Creazione account fallita. Riprova.",
  tmwe_account_already_linked: "Questo account TMWE è già collegato a un altro utente.",
  invalid_state: "Sessione di login scaduta. Riprova.",
  expired_state: "Sessione di login scaduta. Riprova.",
  magiclink_failed: "Generazione del link di accesso fallita. Riprova.",
};

export function LoginPage(): React.ReactElement {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/v2";

  const { isAuthenticated, isLoading: authLoading } = useAuthV2();

  const [tmweSubmitting, setTmweSubmitting] = useState(false);
  const [tmweError, setTmweError] = useState<string | null>(null);

  // Surface TMWE callback errors via ?tmwe=error&reason=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("tmwe") === "error") {
      const reason = params.get("reason") ?? "unknown";
      setTmweError(REASON_MESSAGES[reason] ?? `Login TMWE fallito: ${reason}`);
    }
  }, [location.search]);

  const handleTmweLogin = useCallback(async () => {
    setTmweError(null);
    setTmweSubmitting(true);
    try {
      const url = await tmweLoginStart();
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTmweError(msg);
      setTmweSubmitting(false);
    }
  }, []);

  // Hook order stable: redirect after all hooks.
  if (isAuthenticated && !authLoading) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Accesso operatori</h2>
        <p className="text-xs text-muted-foreground">
          Solo le email autorizzate possono entrare. L'autenticazione passa dal tuo account TMWE.
        </p>
      </div>

      <button
        type="button"
        onClick={handleTmweLogin}
        disabled={tmweSubmitting || authLoading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
      >
        {tmweSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plane className="w-4 h-4" />}
        Entra con TMWE
      </button>

      {tmweError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {tmweError}
        </div>
      )}
    </div>
  );
}

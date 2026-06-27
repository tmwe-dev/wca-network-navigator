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
  profile_fetch_failed: "Impossibile recuperare il profilo TMWE. Riprova tra qualche istante.",
  whitelist_check_failed: "Verifica autorizzazione non disponibile. Riprova tra qualche istante.",
  no_tmwe_user_id: "L'account TMWE non espone un identificativo valido.",
  missing_params: "Parametri di login mancanti. Riprova.",
};

export function LoginPage(): React.ReactElement {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/v2/command";

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

    // Rileva subito l'iframe: in preview/editor non dobbiamo mai provare
    // a navigare window.top, perché il browser lo blocca come cross-origin.
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }

    // Se siamo in iframe apriamo la tab vuota subito nel gesto utente: dopo
    // l'await il popup potrebbe essere bloccato. Poi ci carichiamo l'URL OAuth.
    const tmwePopup = inIframe ? window.open("about:blank", "_blank") : null;
    try {
      const url = await tmweLoginStart();

      if (inIframe) {
        if (tmwePopup) {
          try {
            tmwePopup.opener = null;
            tmwePopup.location.replace(url);
          } catch {
            tmwePopup.location.href = url;
          }
        } else {
          setTmweError(
            "Il browser ha bloccato l'apertura del login. Apri l'app in una scheda intera (non nell'editor) e riprova, oppure consenti i popup.",
          );
        }
        setTmweSubmitting(false);
      } else {
        window.location.href = url;
      }
    } catch (err) {
      if (tmwePopup && !tmwePopup.closed) tmwePopup.close();
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

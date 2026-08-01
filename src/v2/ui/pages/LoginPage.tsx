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
import { tmweLoginStart } from "@/application/data/tmwe";

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

  const [tmweLoginUrl, setTmweLoginUrl] = useState<string | null>(null);
  const [tmwePreparing, setTmwePreparing] = useState(false);
  // Errori del callback OAuth (?tmwe=error&reason=...) e errori di avvio login
  // sono separati: il refresh periodico dell'URL di login non deve cancellare
  // il motivo di rifiuto mostrato all'utente.
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const tmweError = callbackError ?? startError;
  const [isEmbedded] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  const prepareTmweLogin = useCallback(async () => {
    setTmwePreparing(true);
    setStartError(null);
    try {
      const url = await tmweLoginStart();
      setTmweLoginUrl(url);
    } catch (err) {
      setTmweLoginUrl(null);
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setTmwePreparing(false);
    }
  }, []);

  useEffect(() => {
    if (isEmbedded) return;
    void prepareTmweLogin();
    const refresh = window.setInterval(() => void prepareTmweLogin(), 4 * 60 * 1000);
    return () => window.clearInterval(refresh);
  }, [isEmbedded, prepareTmweLogin]);

  // Surface TMWE callback errors via ?tmwe=error&reason=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("tmwe") === "error") {
      const reason = params.get("reason") ?? "unknown";
      setCallbackError(REASON_MESSAGES[reason] ?? `Login TMWE fallito: ${reason}`);
    } else {
      setCallbackError(null);
    }
  }, [location.search]);

  useEffect(() => {
    const goAfterPopupAuth = () => {
      window.location.assign(from);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type === "tmwe-auth-success") goAfterPopupAuth();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "tmwe-auth-success" && event.newValue) goAfterPopupAuth();
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("tmwe-auth");
      channel.onmessage = (event: MessageEvent) => {
        if ((event.data as { type?: string } | null)?.type === "tmwe-auth-success") goAfterPopupAuth();
      };
    } catch {
      // Browser senza BroadcastChannel: storage/postMessage restano disponibili.
    }

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [from]);

  // Hook order stable: redirect after all hooks.
  if (isAuthenticated && !authLoading) {
    return <Navigate to={from} replace />;
  }

  const tmweHref = isEmbedded ? "/v2/tmwe-login-popup" : tmweLoginUrl;
  const tmweDisabled = authLoading || tmwePreparing || !tmweHref;
  const tmweLabel = tmwePreparing || (!isEmbedded && !tmweLoginUrl) ? "Preparazione login…" : "Entra con TMWE";

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Accesso operatori</h2>
        <p className="text-xs text-muted-foreground">
          Solo le email autorizzate possono entrare. L'autenticazione passa dal tuo account TMWE.
        </p>
      </div>

      {tmweDisabled ? (
        <button
          type="button"
          onClick={isEmbedded ? undefined : prepareTmweLogin}
          disabled={authLoading || tmwePreparing}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          {tmweLabel}
        </button>
      ) : (
        <a
          href={tmweHref}
          target="_self"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plane className="w-4 h-4" />
          {tmweLabel}
        </a>
      )}

      {tmweError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {tmweError}
        </div>
      )}
    </div>
  );
}

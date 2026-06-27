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

function writeTmwePopupDocument(popup: Window, state: "loading" | "redirecting" | "error", redirectUrl?: string): void {
  const isError = state === "error";
  const title = isError ? "Login TMWE non avviato" : "Accesso TMWE";
  const message = isError
    ? "Non riesco ad aprire il login. Chiudi questa scheda e riprova."
    : state === "redirecting"
      ? "Ti sto portando al login TMWE…"
      : "Preparazione del login TMWE…";
  const redirectScript = redirectUrl
    ? `<script>try{window.opener=null;}catch(e){}window.location.replace(${JSON.stringify(redirectUrl)});<\/script>`
    : "";

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
      main { width: min(360px, calc(100vw - 32px)); text-align: center; border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); border-radius: 12px; padding: 28px; }
      .spinner { width: 28px; height: 28px; margin: 0 auto 16px; border: 3px solid color-mix(in srgb, CanvasText 18%, transparent); border-top-color: Highlight; border-radius: 999px; animation: spin .8s linear infinite; }
      h1 { margin: 0 0 8px; font-size: 18px; }
      p { margin: 0; font-size: 14px; opacity: .72; line-height: 1.5; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main>
      ${isError ? "" : `<div class="spinner" aria-hidden="true"></div>`}
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
    ${redirectScript}
  </body>
</html>`);
  popup.document.close();
}

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

    // In preview/editor il click vive dentro un iframe sandbox: non possiamo
    // navigare window.top. Apriamo subito una tab same-origin con contenuto
    // visibile, poi le scriviamo uno script che naviga sé stessa verso TMWE.
    if (inIframe) {
      const tmwePopup = window.open("about:blank", "_blank");
      if (!tmwePopup) {
        setTmweError(
          "Il browser ha bloccato l'apertura del login. Apri l'app in una scheda intera (non nell'editor) e riprova, oppure consenti i popup.",
        );
        setTmweSubmitting(false);
        return;
      }

      try {
        writeTmwePopupDocument(tmwePopup, "loading");
        const url = await tmweLoginStart();
        if (tmwePopup.closed) {
          setTmweError("La scheda di login è stata chiusa prima dell'apertura di TMWE.");
        } else {
          writeTmwePopupDocument(tmwePopup, "redirecting", url);
        }
      } catch (err) {
        if (!tmwePopup.closed) writeTmwePopupDocument(tmwePopup, "error");
        const msg = err instanceof Error ? err.message : String(err);
        setTmweError(msg);
      } finally {
        setTmweSubmitting(false);
      }
      return;
    }

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

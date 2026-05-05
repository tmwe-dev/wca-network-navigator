/**
 * AuthCallbackPage — Riceve il magic link dopo OAuth TMWE.
 *
 * Atterriamo su questa rotta PUBBLICA perché V2AuthGate redirigerebbe
 * via prima che supabase-js riesca a parsare l'hash `#access_token=...`.
 * Qui aspettiamo deterministicamente che la sessione sia pronta, poi
 * navighiamo a /v2. In caso di errore torniamo su /v2/login con motivo.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AuthCallbackPage(): React.ReactElement {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function consumeHashAndGo(): Promise<void> {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          // Set session esplicitamente: garantisce che sia pronta prima di navigare.
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setErr) throw setErr;
        } else {
          // Se non c'è hash, controlla se la sessione esiste già (race con detectSessionInUrl).
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error("missing_token");
        }

        if (cancelled) return;
        // Pulisci l'hash e vai alla home autenticata.
        window.history.replaceState(null, "", "/v2");
        navigate("/v2", { replace: true });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "callback_failed";
        setError(msg);
        setTimeout(() => navigate(`/v2/login?tmwe=error&reason=${encodeURIComponent(msg)}`, { replace: true }), 1500);
      }
    }

    void consumeHashAndGo();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3 text-center">
      {error ? (
        <p className="text-sm text-destructive">Login fallito: {error}. Reindirizzo…</p>
      ) : (
        <>
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Accesso in corso…</p>
        </>
      )}
    </div>
  );
}

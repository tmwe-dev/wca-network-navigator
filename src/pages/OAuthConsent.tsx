/**
 * OAuthConsent — schermata di consenso per client OAuth che si collegano al server MCP dell'app.
 * Route: /.lovable/oauth/consent?authorization_id=...
 */
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parametro authorization_id mancante nella URL di consenso.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const fullConsentPath = window.location.pathname + window.location.search;
        navigate("/v2/login", {
          replace: true,
          state: { from: { pathname: fullConsentPath } },
        });
        return;
      }
      try {
        const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, navigate]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauthApi().approveAuthorization(authorizationId)
        : await oauthApi().denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("Il server di autorizzazione non ha restituito un URL di redirect.");
        return;
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <h1 className="text-lg font-semibold text-foreground">
          Collega un'app al tuo account
        </h1>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!details && !error && (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        )}

        {details && (
          <>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {details.client?.name ?? details.client?.client_name ?? "Un client esterno"}
              </strong>{" "}
              chiede di collegarsi a WCA Network Navigator.
            </p>
            <p className="text-sm text-muted-foreground">
              Il client potrà chiamare i tool MCP dell'app agendo come te,
              rispettando i permessi e le policy RLS del tuo account.
            </p>
            {details.client?.redirect_uris?.length ? (
              <p className="text-xs text-muted-foreground break-all">
                Redirect URI: {details.client.redirect_uris.join(", ")}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true)}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Approva connessione
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(false)}
                className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Nega
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
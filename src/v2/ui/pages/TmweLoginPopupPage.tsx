/**
 * TmweLoginPopupPage — rotta autosufficiente per login TMWE da iframe.
 *
 * Il parent Lovable/editor non può navigare finestre cross-origin senza
 * SecurityError. Questa pagina nasce nella nuova tab same-origin e poi naviga
 * sé stessa verso il provider TMWE.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { Loader2, Plane } from "lucide-react";
import { tmweLoginStart } from "@/data/tmwe";

export function TmweLoginPopupPage(): React.ReactElement {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startLogin(): Promise<void> {
      try {
        const url = await tmweLoginStart();
        if (cancelled) return;
        try {
          window.opener = null;
        } catch {
          // Non critico: evita solo il legame con la preview quando consentito.
        }
        window.location.replace(url);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    void startLogin();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-sm space-y-4">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-primary">
          {error ? <Plane className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">Accesso TMWE</h1>
          <p className="text-sm text-muted-foreground">
            {error ? "Non riesco ad aprire il login TMWE." : "Apertura del login in corso…"}
          </p>
        </div>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}

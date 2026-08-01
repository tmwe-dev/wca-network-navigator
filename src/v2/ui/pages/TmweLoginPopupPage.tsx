/**
 * TmweLoginPopupPage — pagina intermedia reale per avviare TMWE da iframe.
 *
 * Evita popup `about:blank` e redirect del frame parent: il click apre una
 * rotta same-origin visibile, poi questa pagina genera uno state fresco e
 * naviga sé stessa verso TMWE.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { Loader2, Plane } from "lucide-react";
import { tmweLoginStart } from "@/application/data/tmwe";

export function TmweLoginPopupPage(): React.ReactElement {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start(): Promise<void> {
      try {
        const url = await tmweLoginStart();
        if (!cancelled) window.location.replace(url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center p-6">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-sm space-y-4">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          {error ? <Plane className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Accesso TMWE</h1>
          <p className="text-sm text-muted-foreground">
            {error ? "Non riesco ad avviare il login." : "Ti sto portando al login TMWE…"}
          </p>
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}

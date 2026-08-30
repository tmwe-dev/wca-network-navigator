/**
 * Accesso V3. Pagina pubblica: non passa da PageFrame (non ha né filtri né
 * workflow, e non deve mostrare la navigazione dell'app).
 */
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthProvider";
import { useLogin } from "../useLogin";
import { V3_HOME_PATH } from "@/v3/app/pageContract";

export function LoginPage(): React.ReactElement {
  const location = useLocation();
  const { status } = useAuth();
  const { email, setEmail, password, setPassword, errore, inCorso, submit } = useLogin();

  const destinazione = (location.state as { from?: string } | null)?.from ?? V3_HOME_PATH;

  if (status === "authenticated") {
    return <Navigate to={destinazione} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Navigator</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Accesso</h1>
          <p className="mt-1 text-sm text-muted-foreground">Solo indirizzi autorizzati.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="v3-email" className="text-xs">
              Email
            </Label>
            <Input
              id="v3-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={inCorso}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v3-password" className="text-xs">
              Password
            </Label>
            <Input
              id="v3-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={inCorso}
              required
            />
          </div>

          {errore && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errore}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={inCorso}>
            {inCorso ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Entra
          </Button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;

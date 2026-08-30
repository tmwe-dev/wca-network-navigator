/**
 * Accesso V3 — email + password su whitelist. Nessun OAuth sociale.
 */
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("v3:login");

const MESSAGGI: Record<string, string> = {
  "Invalid login credentials": "Email o password non corrette.",
  "Email not confirmed": "Email non ancora confermata.",
};

export interface UseLoginResult {
  readonly email: string;
  readonly setEmail: (value: string) => void;
  readonly password: string;
  readonly setPassword: (value: string) => void;
  readonly errore: string | null;
  readonly inCorso: boolean;
  readonly submit: (event: React.FormEvent) => void;
}

export function useLogin(): UseLoginResult {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errore, setErrore] = React.useState<string | null>(null);
  const [inCorso, setInCorso] = React.useState(false);

  const submit = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (inCorso) return;

      const indirizzo = email.trim().toLowerCase();
      if (!indirizzo || !password) {
        setErrore("Inserisci email e password.");
        return;
      }

      setInCorso(true);
      setErrore(null);

      void supabase.auth
        .signInWithPassword({ email: indirizzo, password })
        .then(({ error }) => {
          if (error) {
            log.warn("login fallito", { reason: error.message });
            setErrore(MESSAGGI[error.message] ?? "Accesso non riuscito. Riprova.");
          }
        })
        .catch((cause: unknown) => {
          log.error("login: errore imprevisto", { cause });
          setErrore("Servizio di accesso non raggiungibile. Riprova tra qualche istante.");
        })
        .finally(() => setInCorso(false));
    },
    [email, password, inCorso],
  );

  return { email, setEmail, password, setPassword, errore, inCorso, submit };
}

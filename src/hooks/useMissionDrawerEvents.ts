/**
 * useMissionDrawerEvents — Listener per i CustomEvent dispatchati dal MissionDrawer.
 * Centralizza i 9 handler "ContextActionPanel" che prima erano scollegati.
 *
 * Filosofia: meglio "Funzione in arrivo" esplicito che falso successo.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type MissionEventConfig = {
  /** Evento → handler. Se l'handler manca, mostriamo toast.info("In arrivo"). */
  [eventName: string]: ((e: CustomEvent) => void) | "todo";
};

export function useMissionDrawerEvents(config: MissionEventConfig) {
  const navigate = useNavigate();

  useEffect(() => {
    const entries = Object.entries(config);
    const wrapped: Array<[string, EventListener]> = entries.map(([name, handler]) => {
      const fn: EventListener = (e) => {
        if (handler === "todo") {
          toast.info(`"${name}" — funzione in arrivo`, {
            description: "L'azione è registrata ma non ancora collegata al backend.",
          });
          return;
        }
        try {
          handler(e as CustomEvent);
        } catch (err) {
          toast.error(`Errore in ${name}: ${(err as Error).message}`);
        }
      };
      window.addEventListener(name, fn);
      return [name, fn];
    });

    return () => {
      wrapped.forEach(([name, fn]) => window.removeEventListener(name, fn));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // navigate disponibile per consumer
  return { navigate };
}

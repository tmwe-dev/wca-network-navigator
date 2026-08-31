/**
 * Da fare — maschera Operativa unica. "Cosa devo decidere io oggi?"
 *
 * Non duplica logica: monta le tre maschere già esistenti (Approvazioni,
 * Agenda, Coda) sotto una sola barra di sezione. Le rotte singole restano
 * valide, così il cambiamento è reversibile.
 */
import * as React from "react";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ApprovazioniPage = lazy(() =>
  import("@/v3/modules/risposta/pages/ApprovazioniPage").then((m) => ({ default: m.ApprovazioniPage })),
);
const AgendaPage = lazy(() =>
  import("@/v3/modules/programmazione/pages/AgendaPage").then((m) => ({ default: m.AgendaPage })),
);
const CodaPage = lazy(() =>
  import("@/v3/modules/programmazione/pages/CodaPage").then((m) => ({ default: m.CodaPage })),
);

const SEZIONI = [
  { id: "approvazioni", etichetta: "Approvazioni" },
  { id: "agenda", etichetta: "Agenda" },
  { id: "coda", etichetta: "Coda di invio" },
] as const;

type SezioneId = (typeof SEZIONI)[number]["id"];

export function DaFarePage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const richiesta = params.get("sezione");
  const sezione: SezioneId = SEZIONI.some((s) => s.id === richiesta) ? (richiesta as SezioneId) : "approvazioni";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="v3-glass-plain flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-3">
        {SEZIONI.map((s) => (
          <Button
            key={s.id}
            variant={sezione === s.id ? "secondary" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setParams({ sezione: s.id }, { replace: true })}
          >
            {s.etichetta}
          </Button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          }
        >
          {sezione === "approvazioni" && <ApprovazioniPage />}
          {sezione === "agenda" && <AgendaPage />}
          {sezione === "coda" && <CodaPage />}
        </Suspense>
      </div>
    </div>
  );
}

export default DaFarePage;

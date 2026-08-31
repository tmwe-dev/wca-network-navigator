/**
 * Router V3 — un percorso per pagina, nessun alias.
 *
 * Le rotte si registrano solo per le pagine dichiarate `implemented: true`
 * in `pageContract.ts`. Tutto il resto ricade su `V3_HOME_PATH`.
 */
import * as React from "react";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppShell } from "./AppShell";
import { V3_HOME_PATH, V3_PAGES, V3_RINVII_V2 } from "./pageContract";

const LoginPage = lazy(() =>
  import("@/v3/modules/identita/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const OperatoriPage = lazy(() =>
  import("@/v3/modules/identita/pages/OperatoriPage").then((m) => ({ default: m.OperatoriPage })),
);
const ContattiPage = lazy(() => import("@/v3/modules/contatti/pages/ContattiPage").then((m) => ({ default: m.ContattiPage })));
const InboxPage = lazy(() => import("@/v3/modules/messaggi/pages/InboxPage").then((m) => ({ default: m.InboxPage })));
const ConversazionePage = lazy(() => import("@/v3/modules/messaggi/pages/ConversazionePage").then((m) => ({ default: m.ConversazionePage })));
const ContattoPage = lazy(() => import("@/v3/modules/contatti/pages/ContattoPage").then((m) => ({ default: m.ContattoPage })));
const RegolePage = lazy(() => import("@/v3/modules/comprensione/pages/RegolePage").then((m) => ({ default: m.RegolePage })));
const ApprovazioniPage = lazy(() => import("@/v3/modules/risposta/pages/ApprovazioniPage").then((m) => ({ default: m.ApprovazioniPage })));
const AgendaPage = lazy(() => import("@/v3/modules/programmazione/pages/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const CodaPage = lazy(() => import("@/v3/modules/programmazione/pages/CodaPage").then((m) => ({ default: m.CodaPage })));
const DaFarePage = lazy(() => import("@/v3/modules/programmazione/pages/DaFarePage").then((m) => ({ default: m.DaFarePage })));
const AndamentoPage = lazy(() => import("@/v3/modules/tracciamento/pages/AndamentoPage").then((m) => ({ default: m.AndamentoPage })));
const RegistroPage = lazy(() => import("@/v3/modules/tracciamento/pages/RegistroPage").then((m) => ({ default: m.RegistroPage })));
const CanaliPage = lazy(() => import("@/v3/modules/messaggi/pages/CanaliPage").then((m) => ({ default: m.CanaliPage })));
const ImpostazioniPage = lazy(() => import("@/v3/modules/impostazioni/pages/ImpostazioniPage").then((m) => ({ default: m.ImpostazioniPage })));
const CommandPage = lazy(() => import("@/v3/modules/command/pages/CommandPage").then((m) => ({ default: m.CommandPage })));
const ScriviPage = lazy(() => import("@/v3/modules/risposta/pages/ScriviPage").then((m) => ({ default: m.ScriviPage })));
const LaboratorioPage = lazy(() =>
  import("@/v3/modules/impostazioni/pages/LaboratorioPage").then((m) => ({ default: m.LaboratorioPage })),
);
const GalassiaPage = lazy(() => import("@/v3/modules/impostazioni/pages/GalassiaPage").then((m) => ({ default: m.GalassiaPage })));
const Galassia3DPage = lazy(() => import("@/v3/modules/impostazioni/pages/Galassia3DPage").then((m) => ({ default: m.Galassia3DPage })));

function V3Fallback() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}

/** I path sono dichiarati con prefisso assoluto: qui servono relativi a `/v3`. */
function relative(path: string): string {
  return path.replace(/^\/v3\/?/, "");
}

/** Uscita verso la V2: percorso fuori dal router V3, quindi navigazione piena. */
function RinvioV2({ to }: { to: string }): React.ReactElement {
  React.useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <V3Fallback />;
}

export function V3Routes(): React.ReactElement {
  return (
    <Suspense fallback={<V3Fallback />}>
      <Routes>
        <Route path={relative(V3_PAGES.login.path)} element={<LoginPage />} />

        <Route element={<AppShell />}>
          <Route path={relative(V3_PAGES.operatori.path)} element={<OperatoriPage />} />
          <Route path={relative(V3_PAGES.contatti.path)} element={<ContattiPage />} />
          <Route path={relative(V3_PAGES.contatto.path)} element={<ContattoPage />} />
          <Route path={relative(V3_PAGES.inbox.path)} element={<InboxPage />} />
          <Route path={relative(V3_PAGES.conversazione.path)} element={<ConversazionePage />} />
          <Route path={relative(V3_PAGES.regole.path)} element={<RegolePage />} />
          <Route path={relative(V3_PAGES.approvazioni.path)} element={<ApprovazioniPage />} />
          <Route path={relative(V3_PAGES.agenda.path)} element={<AgendaPage />} />
          <Route path={relative(V3_PAGES.coda.path)} element={<CodaPage />} />
          <Route path={relative(V3_PAGES.dafare.path)} element={<DaFarePage />} />
          <Route path={relative(V3_PAGES.andamento.path)} element={<AndamentoPage />} />
          <Route path={relative(V3_PAGES.registro.path)} element={<RegistroPage />} />
          <Route path={relative(V3_PAGES.canali.path)} element={<CanaliPage />} />
          <Route path={relative(V3_PAGES.impostazioni.path)} element={<ImpostazioniPage />} />
          <Route path={relative(V3_PAGES.command.path)} element={<CommandPage />} />
          <Route path={relative(V3_PAGES.scrivi.path)} element={<ScriviPage />} />
          <Route path={relative(V3_PAGES.laboratorio.path)} element={<LaboratorioPage />} />
          <Route path={relative(V3_PAGES.galassia.path)} element={<GalassiaPage />} />
          <Route path={relative(V3_PAGES.galassia3d.path)} element={<Galassia3DPage />} />
        </Route>

        {/* Maschere spostate in V2: il vecchio percorso rimanda alla superficie completa. */}
        {V3_RINVII_V2.map((r) => (
          <Route key={r.path} path={relative(r.path)} element={<RinvioV2 to={r.destinazione} />} />
        ))}

        <Route path="*" element={<Navigate to={V3_HOME_PATH} replace />} />
      </Routes>
    </Suspense>
  );
}

export default V3Routes;

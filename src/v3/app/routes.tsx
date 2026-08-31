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
import { V3_HOME_PATH, V3_PAGES } from "./pageContract";

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
const ModelliPage = lazy(() => import("@/v3/modules/risposta/pages/ModelliPage").then((m) => ({ default: m.ModelliPage })));
const AgendaPage = lazy(() => import("@/v3/modules/programmazione/pages/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const CampagnePage = lazy(() => import("@/v3/modules/programmazione/pages/CampagnePage").then((m) => ({ default: m.CampagnePage })));
const CodaPage = lazy(() => import("@/v3/modules/programmazione/pages/CodaPage").then((m) => ({ default: m.CodaPage })));
const PipelinePage = lazy(() => import("@/v3/modules/tracciamento/pages/PipelinePage").then((m) => ({ default: m.PipelinePage })));
const AndamentoPage = lazy(() => import("@/v3/modules/tracciamento/pages/AndamentoPage").then((m) => ({ default: m.AndamentoPage })));
const RegistroPage = lazy(() => import("@/v3/modules/tracciamento/pages/RegistroPage").then((m) => ({ default: m.RegistroPage })));
const CanaliPage = lazy(() => import("@/v3/modules/messaggi/pages/CanaliPage").then((m) => ({ default: m.CanaliPage })));
const ImpostazioniPage = lazy(() => import("@/v3/modules/impostazioni/pages/ImpostazioniPage").then((m) => ({ default: m.ImpostazioniPage })));
const DuplicatiPage = lazy(() => import("@/v3/modules/contatti/pages/DuplicatiPage").then((m) => ({ default: m.DuplicatiPage })));
const CommandPage = lazy(() => import("@/v3/modules/command/pages/CommandPage").then((m) => ({ default: m.CommandPage })));
const ScriviPage = lazy(() => import("@/v3/modules/risposta/pages/ScriviPage").then((m) => ({ default: m.ScriviPage })));
const ImportazionePage = lazy(() =>
  import("@/v3/modules/contatti/pages/ImportazionePage").then((m) => ({ default: m.ImportazionePage })),
);
const CestinoPage = lazy(() =>
  import("@/v3/modules/contatti/pages/CestinoPage").then((m) => ({ default: m.CestinoPage })),
);
const LaboratorioPage = lazy(() =>
  import("@/v3/modules/impostazioni/pages/LaboratorioPage").then((m) => ({ default: m.LaboratorioPage })),
);
const GalassiaPage = lazy(() => import("@/v3/modules/impostazioni/pages/GalassiaPage").then((m) => ({ default: m.GalassiaPage })));
const ClassificazionePage = lazy(() => import("@/v3/modules/comprensione/pages/ClassificazionePage").then((m) => ({ default: m.ClassificazionePage })));

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
          <Route path={relative(V3_PAGES.classificazione.path)} element={<ClassificazionePage />} />
          <Route path={relative(V3_PAGES.approvazioni.path)} element={<ApprovazioniPage />} />
          <Route path={relative(V3_PAGES.modelli.path)} element={<ModelliPage />} />
          <Route path={relative(V3_PAGES.agenda.path)} element={<AgendaPage />} />
          <Route path={relative(V3_PAGES.campagne.path)} element={<CampagnePage />} />
          <Route path={relative(V3_PAGES.coda.path)} element={<CodaPage />} />
          <Route path={relative(V3_PAGES.pipeline.path)} element={<PipelinePage />} />
          <Route path={relative(V3_PAGES.andamento.path)} element={<AndamentoPage />} />
          <Route path={relative(V3_PAGES.registro.path)} element={<RegistroPage />} />
          <Route path={relative(V3_PAGES.canali.path)} element={<CanaliPage />} />
          <Route path={relative(V3_PAGES.impostazioni.path)} element={<ImpostazioniPage />} />
          <Route path={relative(V3_PAGES.duplicati.path)} element={<DuplicatiPage />} />
          <Route path={relative(V3_PAGES.command.path)} element={<CommandPage />} />
          <Route path={relative(V3_PAGES.scrivi.path)} element={<ScriviPage />} />
          <Route path={relative(V3_PAGES.importazione.path)} element={<ImportazionePage />} />
          <Route path={relative(V3_PAGES.cestino.path)} element={<CestinoPage />} />
          <Route path={relative(V3_PAGES.laboratorio.path)} element={<LaboratorioPage />} />
          <Route path={relative(V3_PAGES.galassia.path)} element={<GalassiaPage />} />
        </Route>

        <Route path="*" element={<Navigate to={V3_HOME_PATH} replace />} />
      </Routes>
    </Suspense>
  );
}

export default V3Routes;

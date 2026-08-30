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
        </Route>

        <Route path="*" element={<Navigate to={V3_HOME_PATH} replace />} />
      </Routes>
    </Suspense>
  );
}

export default V3Routes;

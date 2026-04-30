/**
 * ContattiSection — /v2/pipeline/* unified pipeline with 3 data origins.
 *
 * UX redesign (apr 2026):
 *  - Sezione unica "Contatti" con 3 origini dati selezionabili:
 *      WCA Partner · Contatti CRM · Biglietti da visita
 *    L'origine è in `?origine=wca|crm|biglietti` (default: crm).
 *  - Tab di lavoro condivisi (stessi per tutte e 3 le origini):
 *      Elenco · Kanban · Duplicati · Campagne · Agenda.
 *  - Il primo tab "Elenco" mostra il dataset corretto in base all'origine:
 *      WCA  → NetworkPage (directory partner WCA)
 *      CRM  → ContactsPage (lista + dettaglio a destra)
 *      Biglietti → BusinessCardsHub
 *  - Tutti i vecchi alias (/v2/crm/*, /v2/contacts, /v2/business-cards,
 *    /v2/explore/network) continuano a funzionare via redirect.
 */
import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, NavLink, useSearchParams, useLocation } from "react-router-dom";
import { PageHeaderUnified, type PageHeaderTab } from "@/v2/ui/templates/PageHeaderUnified";
import { Users, Building2, Contact as ContactIcon, UserSquare2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactsPage } from "@/v2/ui/pages/ContactsPage";
import { AgendaPage } from "@/v2/ui/pages/AgendaPage";
import { Campaigns as CampaignsPage } from "@/v2/ui/pages/CampaignsPage";
import { NetworkPage } from "@/v2/ui/pages/NetworkPage";

const ContactPipelineView = lazy(() =>
  import("@/components/contacts/ContactPipelineView").then((m) => ({
    default: m.ContactPipelineView,
  })),
);
const BusinessCardsHub = lazy(() => import("@/components/contacts/BusinessCardsHub"));
const DuplicateDetector = lazy(() =>
  import("@/components/contacts/DuplicateDetector").then((m) => ({
    default: m.DuplicateDetector,
  })),
);

/** Tab di lavoro condivisi tra le 3 origini (fase 1: replica gli attuali). */
const TABS: readonly PageHeaderTab[] = [
  { key: "contacts",   label: "Elenco",    to: "/v2/pipeline/contacts"   },
  { key: "kanban",     label: "Kanban",    to: "/v2/pipeline/kanban"     },
  { key: "duplicati",  label: "Duplicati", to: "/v2/pipeline/duplicati"  },
  { key: "campaigns",  label: "Campagne",  to: "/v2/pipeline/campaigns"  },
  { key: "agenda",     label: "Agenda",    to: "/v2/pipeline/agenda"     },
];

type OrigineKey = "wca" | "crm" | "biglietti";

const ORIGINI: readonly { key: OrigineKey; label: string; icon: typeof Users }[] = [
  { key: "wca",       label: "WCA Partner",  icon: Building2   },
  { key: "crm",       label: "Contatti",     icon: UserSquare2 },
  { key: "biglietti", label: "Biglietti",    icon: ContactIcon },
];

/** Estrae l'origine dal query param, default = "crm". */
function useOrigine(): OrigineKey {
  const [params] = useSearchParams();
  const raw = (params.get("origine") ?? "").toLowerCase();
  if (raw === "wca" || raw === "biglietti") return raw;
  return "crm";
}

/** Selettore origine inline: chips sottili sotto ai tab di lavoro. Preserva il path corrente. */
function OrigineSwitcherInline({ origine }: { origine: OrigineKey }): React.ReactElement {
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  const buildTo = React.useCallback(
    (key: OrigineKey) => {
      const next = new URLSearchParams(params);
      next.set("origine", key);
      const qs = next.toString();
      return `${pathname}${qs ? `?${qs}` : ""}`;
    },
    [pathname, params],
  );

  return (
    <div
      data-testid="origine-switcher"
      className="flex items-center gap-1.5 min-w-0"
    >
      {ORIGINI.map(({ key, label, icon: Icon }) => {
        const active = key === origine;
        return (
          <NavLink
            key={key}
            to={buildTo(key)}
            replace
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition-colors whitespace-nowrap",
              active
                ? "bg-primary/15 text-primary border-primary/40"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-3 w-3" />
            {label}
          </NavLink>
        );
      })}
    </div>
  );
}

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

/**
 * Tab "Elenco" origine-aware: cambia il componente in base a `?origine=`.
 */
function ElencoOrigineAware(): React.ReactElement {
  const origine = useOrigine();
  if (origine === "wca") {
    return <NetworkPage />;
  }
  if (origine === "biglietti") {
    return (
      <Suspense fallback={<TabFallback />}>
        <BusinessCardsHub />
      </Suspense>
    );
  }
  return <ContactsPage />;
}

export function PipelineSection(): React.ReactElement {
  const origine = useOrigine();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeaderUnified
        sectionIcon={Users}
        sectionLabel="Contatti"
        tabs={TABS}
        rootPath="/v2/pipeline"
        subRow={<OrigineSwitcherInline origine={origine} />}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route index element={<Navigate to={`/v2/pipeline/contacts?origine=${origine}`} replace />} />
          <Route path="contacts"  element={<ElencoOrigineAware />} />
          {/* Alias: la vecchia rotta /v2/pipeline/biglietti ora è equivalente a contacts?origine=biglietti */}
          <Route
            path="biglietti"
            element={<Navigate to="/v2/pipeline/contacts?origine=biglietti" replace />}
          />
          <Route
            path="kanban"
            element={
              <Suspense fallback={<TabFallback />}>
                <ContactPipelineView />
              </Suspense>
            }
          />
          <Route
            path="duplicati"
            element={
              <Suspense fallback={<TabFallback />}>
                <DuplicateDetector />
              </Suspense>
            }
          />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="agenda"    element={<AgendaPage />} />
          {/* Legacy: deals removed → redirect to default */}
          <Route path="deals"     element={<Navigate to="/v2/pipeline/kanban" replace />} />
          <Route path="*"         element={<Navigate to="/v2/pipeline/contacts" replace />} />
        </Routes>
      </div>
    </div>
  );
}
export default PipelineSection;

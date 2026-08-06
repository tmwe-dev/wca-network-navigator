/**
 * CommsPage — guscio unificato "Comunicazioni" (Fase 3 Lean Mode).
 *
 * Monta in 5 tab le pagine canali esistenti senza modificarle.
 * I vecchi path (/v2/inbox, /v2/email, /v2/rubrica/*, /v2/funnemail-inbox,
 * /v2/email-intelligence) restano attivi via deep-link per non rompere
 * bookmark/redirect storici.
 *
 * Deep-link: /v2/comms/:tab  (tab ∈ inbox|email|whatsapp|linkedin|smistamento)
 */
import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";
import { StandardPageFrame } from "@/v2/ui/templates/StandardPageFrame";
import type { SectionTab } from "@/v2/ui/templates/SectionTabs";

const InreachPage = lazy(() => import("./InreachPage").then((m) => ({ default: m.InreachPage })));
const EmailComposerPage = lazy(() => import("./EmailComposerPage").then((m) => ({ default: m.EmailComposerPage })));
const RubricaWhatsAppPage = lazy(() =>
  import("./RubricaWhatsAppPage").then((m) => ({ default: m.RubricaWhatsAppPage })),
);
const RubricaLinkedInPage = lazy(() =>
  import("./RubricaLinkedInPage").then((m) => ({ default: m.RubricaLinkedInPage })),
);
const FunnemailInboxPage = lazy(() => import("./FunnemailInboxPage").then((m) => ({ default: m.FunnemailInboxPage })));

type CommsTab = "inbox" | "email" | "whatsapp" | "linkedin" | "smistamento";
const VALID_TABS: readonly CommsTab[] = ["inbox", "email", "whatsapp", "linkedin", "smistamento"];

function isValidTab(value: string | undefined): value is CommsTab {
  return !!value && (VALID_TABS as readonly string[]).includes(value);
}

const COMMS_TABS: readonly SectionTab[] = [
  { key: "inbox", label: "Inbox", to: "/v2/comms/inbox" },
  { key: "email", label: "Email", to: "/v2/comms/email" },
  { key: "whatsapp", label: "WhatsApp", to: "/v2/comms/whatsapp" },
  { key: "linkedin", label: "LinkedIn", to: "/v2/comms/linkedin" },
  { key: "smistamento", label: "Smistamento", to: "/v2/comms/smistamento" },
];

export function CommsPage(): JSX.Element {
  const { tab } = useParams<{ tab?: string }>();
  const active: CommsTab = isValidTab(tab) ? tab : "inbox";

  return (
    <StandardPageFrame title="Comunicazioni" tabs={COMMS_TABS} tabsRootPath="/v2/comms" contentOverflow="auto">
      <FeatureErrorBoundary featureName={`Comms.${active}`}>
        <Suspense fallback={<PageSkeleton />}>
          {active === "inbox" && <InreachPage />}
          {active === "email" && <EmailComposerPage />}
          {active === "whatsapp" && <RubricaWhatsAppPage />}
          {active === "linkedin" && <RubricaLinkedInPage />}
          {active === "smistamento" && <FunnemailInboxPage />}
        </Suspense>
      </FeatureErrorBoundary>
    </StandardPageFrame>
  );
}

export default CommsPage;

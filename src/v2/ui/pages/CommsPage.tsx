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
import { lazy, Suspense, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";
import { Inbox, Mail, MessageCircle, Linkedin, Sparkles } from "lucide-react";

const InreachPage = lazy(() =>
  import("./InreachPage").then((m) => ({ default: m.InreachPage })),
);
const EmailComposerPage = lazy(() =>
  import("./EmailComposerPage").then((m) => ({ default: m.EmailComposerPage })),
);
const RubricaWhatsAppPage = lazy(() =>
  import("./RubricaWhatsAppPage").then((m) => ({ default: m.RubricaWhatsAppPage })),
);
const RubricaLinkedInPage = lazy(() =>
  import("./RubricaLinkedInPage").then((m) => ({ default: m.RubricaLinkedInPage })),
);
const FunnemailInboxPage = lazy(() =>
  import("./FunnemailInboxPage").then((m) => ({ default: m.FunnemailInboxPage })),
);

type CommsTab = "inbox" | "email" | "whatsapp" | "linkedin" | "smistamento";
const VALID_TABS: readonly CommsTab[] = ["inbox", "email", "whatsapp", "linkedin", "smistamento"];

function isValidTab(value: string | undefined): value is CommsTab {
  return !!value && (VALID_TABS as readonly string[]).includes(value);
}

export function CommsPage(): JSX.Element {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const active: CommsTab = isValidTab(tab) ? tab : "inbox";

  const onTabChange = useCallback(
    (next: string) => {
      if (next === active) return;
      navigate(`/v2/comms/${next}`, { replace: false });
    },
    [active, navigate],
  );

  return (
    <div className="flex flex-col h-full w-full">
      <div className="border-b border-border bg-background sticky top-0 z-10 px-4 py-2">
        <h1 className="text-lg font-semibold mb-2">Comunicazioni</h1>
        <Tabs value={active} onValueChange={onTabChange}>
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="inbox" className="gap-2">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">Inbox</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="gap-2">
              <Linkedin className="h-4 w-4" />
              <span className="hidden sm:inline">LinkedIn</span>
            </TabsTrigger>
            <TabsTrigger value="smistamento" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Smistamento</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <FeatureErrorBoundary featureName={`Comms.${active}`}>
          <Suspense fallback={<PageSkeleton />}>
            {active === "inbox" && <InreachPage />}
            {active === "email" && <EmailComposerPage />}
            {active === "whatsapp" && <RubricaWhatsAppPage />}
            {active === "linkedin" && <RubricaLinkedInPage />}
            {active === "smistamento" && <FunnemailInboxPage />}
          </Suspense>
        </FeatureErrorBoundary>
      </div>
    </div>
  );
}

export default CommsPage;
/**
 * EmailComposerWizard — 2-step "flip" wizard nella sidebar Email Composer.
 * Step 1: selezione destinatari (EmailComposerContactPicker)
 * Step 2: configurazione email AI (EmailComposeFiltersSection)
 * Animazione flip 3D, CTA ↔ in entrambi gli step.
 */
import * as React from "react";
import { ArrowRight, ArrowLeft, Check, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailComposerContactPicker } from "@/components/global/EmailComposerContactPicker";
import { EmailComposeFiltersSection } from "./EmailComposeFiltersSection";
import { SidebarBanner } from "./SidebarBanner";
import { SIDEBAR_BANNER_REGISTRY } from "./sidebarContextRegistry";

export function EmailComposerWizard({ onConfirm }: { onConfirm?: () => void }): React.ReactElement {
  const [step, setStep] = React.useState<"recipients" | "config">("recipients");
  const recipientsBanner = SIDEBAR_BANNER_REGISTRY["email-composer"];
  const configBanner = SIDEBAR_BANNER_REGISTRY["email-compose"];

  return (
    <div className="flex flex-col h-full min-h-[640px]" style={{ perspective: "1400px" }}>
      <div
        className="relative flex-1 min-h-0 transition-transform duration-500 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: step === "config" ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* FRONT: destinatari */}
        <div
          className="absolute inset-0 flex flex-col gap-3"
          style={{ backfaceVisibility: "hidden" }}
          aria-hidden={step !== "recipients"}
        >
          <SidebarBanner
            icon={recipientsBanner.icon}
            title={recipientsBanner.title}
            description={recipientsBanner.description}
            tone={recipientsBanner.tone}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <EmailComposerContactPicker onConfirm={onConfirm} />
          </div>
          <Button
            size="sm"
            className="h-10 gap-2 text-xs font-semibold w-full"
            onClick={() => setStep("config")}
          >
            <Mail className="w-3.5 h-3.5" />
            Avanti: configura tipo di email
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* BACK: configurazione tipo/tono/brief */}
        <div
          className="absolute inset-0 flex flex-col gap-3"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          aria-hidden={step !== "config"}
        >
          <SidebarBanner
            icon={configBanner.icon}
            title={configBanner.title}
            description={configBanner.description}
            tone={configBanner.tone}
          />
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <EmailComposeFiltersSection />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-10 gap-2 text-xs flex-1"
              onClick={() => setStep("recipients")}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <Users className="w-3.5 h-3.5" />
              Destinatari
            </Button>
            <Button
              size="sm"
              className="h-10 gap-2 text-xs flex-1 font-semibold"
              onClick={() => onConfirm?.()}
            >
              <Check className="w-3.5 h-3.5" />
              Conferma
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
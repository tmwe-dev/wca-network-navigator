import { useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, RotateCcw, Check, Mail, MessageCircle, Linkedin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailComposerContactPicker } from "@/components/global/EmailComposerContactPicker";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";
import { useFiltersDrawerState } from "./useFiltersDrawerState";
import { CockpitFiltersSection } from "./CockpitFiltersSection";
import { AttivitaFiltersSection } from "./AttivitaFiltersSection";
import { WorkspaceFiltersSection } from "./WorkspaceFiltersSection";
import { OutgoingFiltersSection } from "./OutgoingFiltersSection";
import { CircuitFiltersSection } from "./CircuitFiltersSection";
import { AgendaFiltersSection } from "./AgendaFiltersSection";
import { InboxFiltersSection } from "./InboxFiltersSection";
import { NetworkFiltersSection } from "./NetworkFiltersSection";
import { CRMFiltersSection } from "./CRMFiltersSection";
import { BCAFiltersSection } from "./BCAFiltersSection";
import { CampaignsFiltersSection } from "./CampaignsFiltersSection";
import { FilterSection, ChipGroup, Chip } from "./shared";
import type { FiltersDrawerProps } from "./types";

export function FiltersDrawer({ open, onOpenChange }: FiltersDrawerProps) {
  const state = useFiltersDrawerState(onOpenChange);
  const resizeRef = useRef<HTMLDivElement>(null);

  const defaultWidthClass = state.isEmailComposer
    ? "w-[92vw] sm:w-[560px] sm:max-w-[620px]"
    : "w-[90vw] sm:w-[400px] sm:max-w-[420px]";

  return (
    <PageErrorBoundary>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className={cn("p-0 flex flex-col border-r border-primary/10 backdrop-blur-xl", !state.drawerWidth && defaultWidthClass)}
          style={{
            ...(state.drawerWidth ? { width: state.drawerWidth, maxWidth: "80vw" } : {}),
            background: "linear-gradient(to right, hsl(0 0% 0%) 0%, hsl(0 0% 0%) 20%, hsl(var(--background)) 40%)",
          }}
        >
          {/* Header */}
          <div className="px-5 py-3 border-b border-border/50 bg-gradient-to-r from-transparent to-primary/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">Filtri</h3>
                <p className="text-[11px] text-muted-foreground">{state.sectionTitle}</p>
              </div>
              {state.activeCount > 0 && (
                <span className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-semibold">{state.activeCount}</span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {state.isCockpit && (
              <CockpitFiltersSection
                countryStats={state.countryStats}
                toggleOrigin={state.toggleOrigin}
                toggleCockpitCountry={state.toggleCockpitCountry}
                toggleCockpitChannel={state.toggleCockpitChannel}
                toggleCockpitQuality={state.toggleCockpitQuality}
              />
            )}
            {state.isAttivita && <AttivitaFiltersSection />}
            {state.isWorkspace && <WorkspaceFiltersSection toggleWs={state.toggleWs} />}
            {state.isInUscita && <OutgoingFiltersSection />}
            {state.isCircuito && <CircuitFiltersSection />}
            {state.isInbox && (
              <InboxFiltersSection
                channel={state.isEmail ? "email" : state.isWhatsApp ? "whatsapp" : "linkedin"}
                channelIcon={state.isEmail ? Mail : state.isWhatsApp ? MessageCircle : Linkedin}
              />
            )}
            {/* Sezione esclusiva di /v2/inreach: raggruppamento per mittente */}
            {state.isInreach && (
              <FilterSection icon={Users} label="Visualizzazione">
                <ChipGroup>
                  <Chip
                    active={!state.g.filters.inreachGroupBySender}
                    onClick={() => state.g.setFilter("inreachGroupBySender", false)}
                  >
                    Lista cronologica
                  </Chip>
                  <Chip
                    active={state.g.filters.inreachGroupBySender}
                    onClick={() => state.g.setFilter("inreachGroupBySender", true)}
                  >
                    Raggruppa per mittente
                  </Chip>
                </ChipGroup>
              </FilterSection>
            )}
            {state.isNetwork && <NetworkFiltersSection />}
            {state.isCRM && state.g.filters.crmActiveTab === "contatti" && <CRMFiltersSection />}
            {state.isCRM && state.g.filters.crmActiveTab === "biglietti" && <BCAFiltersSection />}
            {state.isAgenda && <AgendaFiltersSection />}
            {state.isCampaigns && <CampaignsFiltersSection />}
            {state.isEmailComposer && <EmailComposerContactPicker onConfirm={() => onOpenChange(false)} />}

            {!state.isOutreach && !state.isNetwork && !state.isCRM && !state.isAgenda && !state.isEmailComposer && !state.isCampaigns && !state.isInreach && (
              <div className="text-center py-8 text-muted-foreground">
                <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nessun filtro per questa sezione</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border/50 bg-muted/20 flex gap-2">
            <Button variant="outline" className="flex-1 h-9 gap-2 text-xs" onClick={state.handleResetAll} disabled={state.activeCount === 0}>
              <RotateCcw className="w-3.5 h-3.5" /> Reset ({state.activeCount})
            </Button>
            <Button className="flex-1 h-9 gap-2 text-xs" onClick={() => onOpenChange(false)}>
              <Check className="w-3.5 h-3.5" /> Conferma
            </Button>
          </div>

          {/* Resize handle */}
          <div
            ref={resizeRef}
            onMouseDown={state.startResize}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50"
          />
        </SheetContent>
      </Sheet>
    </PageErrorBoundary>
  );
}

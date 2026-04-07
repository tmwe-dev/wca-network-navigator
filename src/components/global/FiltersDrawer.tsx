import { useState, useMemo, useEffect, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, RotateCcw, Check, Mail, MessageCircle, Linkedin } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { EmailComposerContactPicker } from "@/components/global/EmailComposerContactPicker";

import { CockpitFilters } from "./filters/CockpitFilters";
import { AttivitaFilters } from "./filters/AttivitaFilters";
import { WorkspaceFilters } from "./filters/WorkspaceFilters";
import { InUscitaFilters } from "./filters/InUscitaFilters";
import { CircuitoFilters } from "./filters/CircuitoFilters";
import { InboxFilters } from "./filters/InboxFilters";
import { NetworkFilters } from "./filters/NetworkFilters";
import { CRMFilters } from "./filters/CRMFilters";
import { BCAFilters } from "./filters/BCAFilters";
import { AgendaFilters } from "./filters/AgendaFilters";

interface FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FiltersDrawer({ open, onOpenChange }: FiltersDrawerProps) {
  const g = useGlobalFilters();
  const location = useLocation();
  const [drawerWidth, setDrawerWidth] = useState<number | null>(null);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const w = Math.max(320, Math.min(ev.clientX, window.innerWidth * 0.8));
      setDrawerWidth(w);
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const resizeRef = useRef<HTMLDivElement>(null);

  const route = location.pathname;
  const isOutreach = route === "/outreach";
  const isNetwork = route === "/network";
  const isCRM = route === "/crm";
  const isAgenda = route === "/agenda";
  const isEmailComposer = route === "/email-composer";

  const outreachTab = g.filters.outreachTab;
  const isCockpit = isOutreach && outreachTab === "cockpit";
  const isWorkspace = isOutreach && outreachTab === "workspace";
  const isInUscita = isOutreach && outreachTab === "inuscita";
  const isCircuito = isOutreach && outreachTab === "circuito";
  const isAttivita = isOutreach && outreachTab === "attivita";
  const isEmail = isOutreach && outreachTab === "email";
  const isWhatsApp = isOutreach && outreachTab === "whatsapp";
  const isLinkedIn = isOutreach && outreachTab === "linkedin";
  const isInbox = isEmail || isWhatsApp || isLinkedIn;

  const sectionTitle = isCockpit ? "Cockpit" : isWorkspace ? "Workspace" : isInUscita ? "In Uscita" : isCircuito ? "Circuito" : isAttivita ? "Attività" : isEmail ? "Email" : isWhatsApp ? "WhatsApp" : isLinkedIn ? "LinkedIn" : isNetwork ? "Network" : isCRM ? (g.filters.crmActiveTab === "biglietti" ? "Biglietti da visita" : "CRM Contatti") : isAgenda ? "Agenda" : isEmailComposer ? "Email Composer" : "Globale";

  useEffect(() => {
    const handler = () => onOpenChange(false);
    window.addEventListener("filters-drawer-close", handler);
    return () => window.removeEventListener("filters-drawer-close", handler);
  }, [onOpenChange]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (isCockpit) {
      if (g.filters.cockpitCountries.size) n++;
      if (g.filters.cockpitChannels.size) n++;
      if (g.filters.cockpitQuality.size) n++;
      if (g.filters.cockpitStatus !== "all") n++;
      if (g.filters.sortBy !== "name") n++;
      if (g.filters.origin.size < 4) n++;
    }
    if (isAttivita) {
      if (g.filters.attivitaStatus !== "all") n++;
      if (g.filters.attivitaPriority !== "all") n++;
    }
    if (isEmail) {
      if (g.filters.emailCategory !== "all") n++;
      if (g.filters.sortingFilter !== "all") n++;
    }
    if (isNetwork) {
      if (g.filters.networkSearch.trim()) n++;
      if (g.filters.networkQuality !== "all") n++;
      if (g.filters.networkSort !== "name") n++;
      if (g.filters.networkSelectedCountries.size > 0) n++;
    }
    if (isCRM) {
      if (g.filters.leadStatus !== "all") n++;
      if (g.filters.holdingPattern !== "out") n++;
      if (g.filters.crmQuality !== "all") n++;
      if (g.filters.crmChannel !== "all") n++;
    }
    return n;
  }, [g.filters, isCockpit, isAttivita, isEmail, isNetwork, isCRM]);

  const handleResetAll = () => {
    if (isCockpit) {
      g.setCockpitCountries(new Set());
      g.setCockpitChannels(new Set());
      g.setCockpitQuality(new Set());
      g.setCockpitStatus("all");
      g.setSortBy("name");
      g.setOrigin(new Set(["wca", "import", "report_aziende", "bca"]));
      g.setSearch("");
    }
    if (isAttivita) {
      g.setAttivitaStatus("all");
      g.setAttivitaPriority("all");
      g.setSearch("");
    }
    if (isEmail || isWhatsApp || isLinkedIn) {
      g.setSortingFilter("all");
      g.setEmailCategory("all");
      g.setEmailSort("date_desc");
      g.setSortBy("date_desc");
      g.setSortingSearch("");
    }
    if (isWorkspace) {
      g.setWorkspaceFilters(new Set());
      g.setEmailGenFilter("all");
      g.setSearch("");
    }
    if (isInUscita) {
      g.setSortingFilter("all");
      g.setSortingSearch("");
    }
    if (isNetwork) {
      g.setNetworkSearch("");
      g.setNetworkQuality("all");
      g.setNetworkSort("name");
      g.setNetworkSelectedCountries(new Set());
      g.setNetworkDirectoryOnly(false);
    }
    if (isCRM) {
      g.setSearch("");
      g.setLeadStatus("all");
      g.setHoldingPattern("out");
      g.setCrmQuality("all");
      g.setCrmChannel("all");
      g.setGroupBy("country");
      g.setSortBy("name");
    }
  };

  const defaultWidthClass = isEmailComposer ? "w-[92vw] sm:w-[560px] sm:max-w-[620px]" : "w-[90vw] sm:w-[400px] sm:max-w-[420px]";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className={cn("p-0 flex flex-col border-r border-primary/10 backdrop-blur-xl", !drawerWidth && defaultWidthClass)} style={{ ...(drawerWidth ? { width: drawerWidth, maxWidth: "80vw" } : {}), background: "linear-gradient(to right, hsl(0 0% 0%) 0%, hsl(0 0% 0%) 20%, hsl(var(--background)) 40%)" }}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-border/50 bg-gradient-to-r from-transparent to-primary/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Filtri</h3>
              <p className="text-[11px] text-muted-foreground">{sectionTitle}</p>
            </div>
            {activeCount > 0 && (
              <span className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-semibold">{activeCount}</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isCockpit && <CockpitFilters />}
          {isAttivita && <AttivitaFilters />}
          {isWorkspace && <WorkspaceFilters />}
          {isInUscita && <InUscitaFilters />}
          {isCircuito && <CircuitoFilters />}
          {isInbox && (
            <InboxFilters
              channel={isEmail ? "email" : isWhatsApp ? "whatsapp" : "linkedin"}
              channelIcon={isEmail ? Mail : isWhatsApp ? MessageCircle : Linkedin}
            />
          )}
          {isNetwork && <NetworkFilters />}
          {isCRM && g.filters.crmActiveTab === "contatti" && <CRMFilters />}
          {isCRM && g.filters.crmActiveTab === "biglietti" && <BCAFilters />}
          {isAgenda && <AgendaFilters />}
          {isEmailComposer && <EmailComposerContactPicker onConfirm={() => onOpenChange(false)} />}

          {!isOutreach && !isNetwork && !isCRM && !isAgenda && !isEmailComposer && (
            <div className="text-center py-8 text-muted-foreground">
              <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nessun filtro per questa sezione</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/50 bg-muted/20 flex gap-2">
          <Button variant="outline" className="flex-1 h-9 gap-2 text-xs" onClick={handleResetAll} disabled={activeCount === 0}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset ({activeCount})
          </Button>
          <Button className="flex-1 h-9 gap-2 text-xs" onClick={() => onOpenChange(false)}>
            <Check className="w-3.5 h-3.5" /> Conferma
          </Button>
        </div>
        {/* Resize handle */}
        <div
          ref={resizeRef}
          onMouseDown={startResize}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50"
        />
      </SheetContent>
    </Sheet>
  );
}

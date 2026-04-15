import { useState } from "react";
import AiEntity from "@/design-system/AiEntity";
import VoicePresence from "@/design-system/VoicePresence";
import ExecutionFlow from "@/design-system/ExecutionFlow";
import ApprovalPanel from "@/design-system/ApprovalPanel";
import CanvasShell from "@/design-system/CanvasShell";
import FloatingDock from "@/design-system/FloatingDock";
import ToolActivationBar from "@/design-system/ToolActivationBar";
import { Home, Settings, Users, Zap, Search, Brain, Shield, Database } from "lucide-react";

const mockSteps = [
  { label: "Connessione al database partner", status: "done" as const, detail: "1.2s" },
  { label: "Analisi contatti recenti", status: "done" as const, detail: "0.8s" },
  { label: "Calcolo score churn prediction", status: "running" as const, detail: "ML v3.2" },
  { label: "Generazione report executive", status: "pending" as const },
  { label: "Invio notifica al team", status: "pending" as const },
];

const mockTools = [
  { icon: Database, label: "Unify Sources", color: "38 90% 50%" },
  { icon: Search, label: "Search Partners", color: "210 100% 66%" },
  { icon: Brain, label: "Run ML Scoring", color: "152 60% 45%" },
  { icon: Shield, label: "Governance Check", color: "270 60% 62%" },
];

const mockSources = [
  { name: "WCA Partner Network", color: "210 100% 66%" },
  { name: "CRM Core", color: "152 60% 45%" },
  { name: "Activity Engine", color: "270 60% 62%" },
];

const mockDockItems = [
  { to: "/v2/design-system-preview", icon: <Home className="w-4 h-4" strokeWidth={1.5} /> },
  { to: "/v2/network", icon: <Users className="w-4 h-4" strokeWidth={1.5} /> },
  { to: "/v2/agents", icon: <Zap className="w-4 h-4" strokeWidth={1.5} /> },
  { to: "/v2/settings", icon: <Settings className="w-4 h-4" strokeWidth={1.5} /> },
];

export function DesignSystemPreviewPage() {
  const [canvasOpen, setCanvasOpen] = useState(true);

  return (
    <div className="p-6 space-y-12 max-w-4xl mx-auto pb-24">
      <div>
        <h1 className="text-2xl font-light tracking-tight text-foreground mb-2">Design System Preview</h1>
        <p className="text-sm text-muted-foreground">Componenti IntelliFlow portati in WCA — showcase interattivo</p>
      </div>

      {/* AiEntity */}
      <section>
        <h2 className="section-label mb-4">AI ENTITY</h2>
        <div className="flex items-end gap-8 flex-wrap">
          {(["sm", "md", "lg", "hero"] as const).map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <AiEntity size={size} />
              <span className="text-[9px] text-muted-foreground font-mono">{size}</span>
            </div>
          ))}
        </div>
      </section>

      {/* VoicePresence */}
      <section>
        <h2 className="section-label mb-4">VOICE PRESENCE</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="float-panel-subtle p-4">
            <span className="text-[9px] text-muted-foreground font-mono mb-2 block">IDLE</span>
            <VoicePresence active listening={false} speaking={false} />
          </div>
          <div className="float-panel-subtle p-4">
            <span className="text-[9px] text-muted-foreground font-mono mb-2 block">LISTENING</span>
            <VoicePresence active listening speaking={false} />
          </div>
          <div className="float-panel-subtle p-4">
            <span className="text-[9px] text-muted-foreground font-mono mb-2 block">SPEAKING</span>
            <VoicePresence active listening={false} speaking />
          </div>
        </div>
      </section>

      {/* ExecutionFlow */}
      <section>
        <h2 className="section-label mb-4">EXECUTION FLOW</h2>
        <ExecutionFlow visible steps={mockSteps} progress={60} />
      </section>

      {/* ApprovalPanel */}
      <section>
        <h2 className="section-label mb-4">APPROVAL PANEL</h2>
        <ApprovalPanel
          visible
          title="Conferma invio campagna re-engagement"
          description="L'agente ha preparato 50 email personalizzate per i partner inattivi in Asia Pacific. Ogni messaggio è stato generato sulla base dei dati CRM e della conversation history."
          details={[
            { label: "Destinatari", value: "50 partner" },
            { label: "Template", value: "Re-engagement Q1" },
            { label: "Canale", value: "Email" },
          ]}
          governance={{ role: "ADMIN", permission: "SEND_BATCH", policy: "approval_required" }}
          onApprove={() => console.log("approved")}
          onModify={() => console.log("modify")}
          onCancel={() => console.log("cancel")}
        />
      </section>

      {/* CanvasShell */}
      <section>
        <h2 className="section-label mb-4">CANVAS SHELL</h2>
        {canvasOpen ? (
          <div className="h-[300px]">
            <CanvasShell onClose={() => setCanvasOpen(false)} title="ANALISI · DEMO">
              <div className="space-y-3">
                {["Alpha Logistics Co.", "Beta Freight GmbH", "Gamma Shipping Ltd."].map((name) => (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-border/20">
                    <span className="text-[13px] font-light text-foreground">{name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">Score: {Math.floor(Math.random() * 40 + 60)}</span>
                  </div>
                ))}
              </div>
            </CanvasShell>
          </div>
        ) : (
          <button onClick={() => setCanvasOpen(true)} className="pill">Riapri Canvas</button>
        )}
      </section>

      {/* ToolActivationBar */}
      <section>
        <h2 className="section-label mb-4">TOOL ACTIVATION BAR</h2>
        <div className="float-panel-subtle p-4">
          <ToolActivationBar
            tools={mockTools}
            sources={mockSources}
            visible
            phase="active"
            chainHighlight={3}
          />
        </div>
      </section>

      {/* FloatingDock */}
      <section>
        <h2 className="section-label mb-4">FLOATING DOCK</h2>
        <p className="text-[11px] text-muted-foreground mb-2">Il dock è fisso in basso ↓</p>
      </section>

      <FloatingDock items={mockDockItems} />
    </div>
  );
}

export default DesignSystemPreviewPage;

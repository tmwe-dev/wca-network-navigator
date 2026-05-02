/**
 * KBSupervisorPage — Pagina V2 con split-panel chat 40% / canvas 60%
 */
import { ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { PersistentResizablePanelGroup } from "@/v2/ui/atoms/PersistentResizablePanelGroup";
import { KBSupervisorChat } from "@/components/kb-supervisor/KBSupervisorChat";
import { KBSupervisorCanvas } from "@/components/kb-supervisor/KBSupervisorCanvas";
import { KBSupervisorHeader } from "@/components/kb-supervisor/KBSupervisorHeader";
import { KBSupervisorFooter } from "@/components/kb-supervisor/KBSupervisorFooter";
import { useKBSupervisorState } from "./kb-supervisor/hooks/useKBSupervisorState";
import { PageTitleHint } from "@/v2/ui/atoms/PageTitleHint";

export function KBSupervisorPage() {
  const supervisor = useKBSupervisorState();

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageTitleHint
        title="KB Supervisor"
        hint="Gestisci la Knowledge Base degli agenti: documenti, dottrine, playbook. Parla o scrivi per analizzare, proporre modifiche e migliorare la KB. Le modifiche sono subito attive — usa la modalità Guidato per richiedere conferma."
      />
      <KBSupervisorHeader
        mode={supervisor.mode}
        onModeChange={supervisor.setMode}
        isVoiceConnected={supervisor.isVoiceConnected}
        auditStatus={supervisor.auditStatus}
      />

      <div className="flex-1 overflow-hidden">
        <PersistentResizablePanelGroup direction="horizontal" storageId="kb-supervisor:chat-vs-canvas">
          <ResizablePanel defaultSize={40} minSize={30}>
            <KBSupervisorChat
              messages={supervisor.messages}
              onSendMessage={supervisor.sendMessage}
              isLoading={supervisor.isLoading}
              voiceEnabled={supervisor.voiceEnabled}
              onToggleVoice={supervisor.toggleVoice}
              isListening={supervisor.isListening}
              isSpeaking={supervisor.isSpeaking}
              onStartListening={supervisor.startListening}
              onStopListening={supervisor.stopListening}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={60} minSize={40}>
            <KBSupervisorCanvas
              activeDocument={supervisor.activeDocument}
              proposedChanges={supervisor.proposedChanges}
              canvasTab={supervisor.canvasTab}
              onTabChange={supervisor.setCanvasTab}
              onApprove={supervisor.approveChange}
              onReject={supervisor.rejectChange}
              onEdit={supervisor.editDocument}
              onSave={supervisor.saveDocument}
              auditReport={supervisor.auditReport}
              documentList={supervisor.documentList}
              onSelectDocument={supervisor.selectDocument}
            />
          </ResizablePanel>
        </PersistentResizablePanelGroup>
      </div>

      <KBSupervisorFooter
        lastAuditDate={supervisor.lastAuditDate}
        totalDocuments={supervisor.totalDocuments}
        totalIssues={supervisor.totalIssues}
      />
    </div>
  );
}

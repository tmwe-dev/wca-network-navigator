/**
 * EmailComposer — Orchestrator (refactored from 710-line monolith)
 */
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Save, Loader2, Mail, Bookmark, Eye } from "lucide-react";
import HtmlEmailEditor from "@/components/email/HtmlEmailEditor";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";
import { CampaignQueueMonitor } from "@/components/campaigns/CampaignQueueMonitor";
import { useEmailComposerState } from "@/hooks/useEmailComposerState";
import { EmailToolbar } from "@/components/email/EmailToolbar";
import { EmailRecipientFields } from "@/components/email/EmailRecipientFields";
import { EmailAIPanel } from "@/components/email/EmailAIPanel";
import { EmailTemplateSelector } from "@/components/email/EmailTemplateSelector";

export default function EmailComposer() {
  const c = useEmailComposerState();
  const { email, ui, ai, template, queue } = c.state;

  return (
    <PageErrorBoundary>
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 flex justify-center">
        <div className="flex max-w-[1060px] w-full min-h-0">
          {/* LEFT: email editor */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 p-4 pb-0 w-full overflow-y-auto">
              <EmailRecipientFields
                recipients={c.recipients}
                manualEmail={ui.manualEmail}
                unknownEmailDialog={ui.unknownEmailDialog}
                pendingEmail={ui.pendingEmail}
                manualContactName={ui.manualContactName}
                manualCompanyName={ui.manualCompanyName}
                onRemoveRecipient={c.removeRecipient}
                onManualEmailChange={c.setManualEmail}
                onAddManualEmail={c.addManualEmail}
                onSetUnknownDialog={(open) => c.dispatch({ type: "SET_UNKNOWN_DIALOG", payload: open })}
                onManualContactNameChange={(v) => c.dispatch({ type: "SET_MANUAL_CONTACT_NAME", payload: v })}
                onManualCompanyNameChange={(v) => c.dispatch({ type: "SET_MANUAL_COMPANY_NAME", payload: v })}
                onConfirmUnknownEmail={c.confirmUnknownEmail}
              />

              {/* Subject */}
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <Input value={email.subject} onChange={(e) => c.setSubject(e.target.value)}
                  placeholder="Oggetto della email..." className="h-9 text-sm font-medium flex-1" />
              </div>

              <EmailToolbar
                emailLinks={email.emailLinks}
                newLinkLabel={email.newLinkLabel}
                newLinkUrl={email.newLinkUrl}
                selectedAttachments={email.selectedAttachments}
                previewOpen={ui.previewOpen}
                templatesByCategory={c.templatesByCategory}
                onInsertVariable={c.insertVariable}
                onAddLink={c.addLink}
                onRemoveLink={c.removeLink}
                onNewLinkLabelChange={c.setNewLinkLabel}
                onNewLinkUrlChange={c.setNewLinkUrl}
                onToggleAttachment={c.toggleAttachment}
                onTogglePreview={c.togglePreview}
              />

              <HtmlEmailEditor value={email.htmlBody} onChange={c.setHtmlBody}
                placeholder="Scrivi il contenuto della email... Usa variabili come {{company_name}} tramite l'icona { } sopra"
                className="flex-1" />

              {/* Inline preview */}
              {ui.previewOpen && (email.subject || email.htmlBody) && (
                <div className="mt-3 border border-border/30 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/30">
                    <Eye className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold">Anteprima</span>
                  </div>
                  <div className="px-4 py-3 bg-muted/10">
                    <p className="text-sm font-medium mb-1">
                      {email.subject.replace(/\{\{company_name\}\}/g, "Acme Logistics").replace(/\{\{contact_name\}\}/g, "John Doe").replace(/\{\{city\}\}/g, "Milano").replace(/\{\{country\}\}/g, "Italy") || "Nessun oggetto"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mb-2">A: partner@example.com</p>
                    <div className="text-xs prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(c.buildFinalHtml(email.htmlBody, { companyName: "Acme Logistics", city: "Milano", countryName: "Italy" }, "John Doe")),
                      }} />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="shrink-0 border-t border-border/30 bg-muted/10 px-4 py-2.5 max-w-3xl w-full">
              {queue.activeDraftId ? (
                <CampaignQueueMonitor
                  draftId={queue.activeDraftId}
                  queueStatus={queue.activeQueueStatus}
                  onClose={c.closeQueueMonitor}
                  onStatusChange={(s) => c.dispatch({ type: "SET_QUEUE_STATUS", payload: s })}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={c.handleSaveDraft} disabled={queue.sending} className="gap-1.5 h-9 text-xs">
                    <Save className="w-3.5 h-3.5" /> Bozza
                  </Button>
                  {c.isEditedAfterGeneration && (
                    <Button variant="outline" size="sm" onClick={c.openSaveTemplate} className="gap-1.5 h-9 text-xs border-primary/30 text-primary hover:bg-primary/10">
                      <Bookmark className="w-3.5 h-3.5" /> Salva template
                    </Button>
                  )}
                  <Button size="sm" onClick={c.handleEnqueue} disabled={queue.sending || c.processing || c.recipientsWithEmail.length === 0} className="gap-1.5 h-9 text-xs flex-1">
                    {queue.sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {queue.sending ? "Preparazione..." : `Invia a ${c.recipientsWithEmail.length} destinatari`}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Oracle + AI dialogs */}
          <EmailAIPanel
            aiGenerating={ai.aiGenerating}
            aiImproving={ai.aiImproving}
            hasBody={!!email.htmlBody.trim()}
            learningDialogOpen={ai.learningDialogOpen}
            editAnalysis={ai.editAnalysis}
            onGenerate={c.handleAIGenerate}
            onImprove={c.handleAIImprove}
            onLoadTemplate={c.handleLoadTemplate}
            onInsertImage={c.handleInsertImage}
            onCloseLearningDialog={c.closeLearningDialog}
            onSendAndSave={c.handleSendAndSave}
            onSendWithoutSaving={() => { c.closeLearningDialog(); c.executeEnqueue(); }}
          />
        </div>
      </div>

      {/* Save template dialog */}
      <EmailTemplateSelector
        open={template.saveTemplateOpen}
        onOpenChange={(open) => c.dispatch({ type: "SET_SAVE_TEMPLATE_OPEN", payload: open })}
        templateName={template.templateName}
        templateCategory={template.templateCategory}
        customCategory={template.customCategory}
        onTemplateNameChange={(v) => c.dispatch({ type: "SET_TEMPLATE_NAME", payload: v })}
        onTemplateCategoryChange={(v) => c.dispatch({ type: "SET_TEMPLATE_CATEGORY", payload: v })}
        onCustomCategoryChange={(v) => c.dispatch({ type: "SET_CUSTOM_CATEGORY", payload: v })}
        onSave={c.handleSaveAsTemplate}
      />
    </div>
    </PageErrorBoundary>
  );
}

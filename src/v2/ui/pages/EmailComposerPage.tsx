/**
 * EmailComposerPage — Full email editor with AI oracle, HTML editor, recipients
 */
import * as React from "react";
import { useEmailComposerV2 } from "@/v2/hooks/useEmailComposerV2";
import { RecipientPicker } from "../organisms/email/RecipientPicker";
import { EmailEditorPanel } from "../organisms/email/EmailEditorPanel";
import { OraclePanelV2 } from "../organisms/email/OraclePanelV2";
import { EmailBottomBar } from "../organisms/email/EmailBottomBar";

export function EmailComposerPage(): React.ReactElement {
  const composer = useEmailComposerV2();
  const firstRecipient = composer.recipients[0];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — Recipients */}
        <div className="w-[220px] flex-shrink-0 border-r bg-card p-3 overflow-y-auto">
          <RecipientPicker
            recipients={composer.recipients}
            onAdd={composer.addRecipient}
            onRemove={composer.removeRecipient}
          />
        </div>

        {/* Center — Editor */}
        <div className="flex-1 flex flex-col min-w-0 p-4 overflow-y-auto">
          <EmailEditorPanel
            subject={composer.subject}
            onSubjectChange={composer.setSubject}
            body={composer.body}
            onBodyChange={composer.setBody}
            recipientName={firstRecipient?.name}
            recipientCompany={firstRecipient?.companyName}
          />
        </div>

        {/* Right — Oracle */}
        <OraclePanelV2
          emailType={composer.emailType}
          onEmailTypeChange={composer.setEmailType}
          tone={composer.tone}
          onToneChange={composer.setTone}
          useKB={composer.useKB}
          onUseKBChange={composer.setUseKB}
          onGenerate={(goal) => composer.generate.mutate(goal)}
          onImprove={() => composer.generate.mutate("Migliora l'email esistente: rendila più concisa e professionale.")}
          isGenerating={composer.generate.isPending}
          templates={composer.templates}
          onSelectTemplate={(instructions) => composer.setBody(instructions)}
        />
      </div>

      {/* Bottom bar */}
      <EmailBottomBar
        recipientCount={composer.recipients.length}
        onSend={() => composer.send.mutate()}
        onSaveDraft={() => composer.saveDraft.mutate()}
        isSending={composer.send.isPending}
        isSaving={composer.saveDraft.isPending}
        canSend={composer.recipients.length > 0 && !!composer.subject && !!composer.body}
      />
    </div>
  );
}

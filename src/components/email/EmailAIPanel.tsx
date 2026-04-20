/**
 * EmailAIPanel — Wraps OraclePanel + EmailEditLearningDialog
 */
import * as React from "react";
import OraclePanel, { type OracleConfig } from "@/components/email/OraclePanel";
import EmailEditLearningDialog, { type EditAnalysis } from "@/components/email/EmailEditLearningDialog";
import type { OracleContextSummary } from "@/components/email/OracleContextPanel";

interface EmailAIPanelProps {
  readonly aiGenerating: boolean;
  readonly aiImproving: boolean;
  readonly hasBody: boolean;
  readonly learningDialogOpen: boolean;
  readonly editAnalysis: EditAnalysis | null;
  readonly onGenerate: (config: OracleConfig) => void;
  readonly onImprove: (config: OracleConfig) => void;
  readonly onLoadTemplate: (name: string, url: string) => void;
  readonly onInsertImage: (url: string) => void;
  readonly onCloseLearningDialog: () => void;
  readonly onSendAndSave: () => void;
  readonly onSendWithoutSaving: () => void;
  readonly recipientPartnerId?: string | null;
  readonly recipientCount?: number;
  readonly contextSummary?: OracleContextSummary | null;
}

export function EmailAIPanel({
  aiGenerating, aiImproving, hasBody,
  learningDialogOpen, editAnalysis,
  onGenerate, onImprove, onLoadTemplate, onInsertImage,
  onCloseLearningDialog, onSendAndSave, onSendWithoutSaving,
  recipientPartnerId = null, recipientCount = 0, contextSummary = null,
}: EmailAIPanelProps): React.ReactElement {
  return (
    <div className="w-[260px] shrink-0 h-full">
      <OraclePanel
        onGenerate={onGenerate}
        onImprove={onImprove}
        onLoadTemplate={onLoadTemplate}
        onInsertImage={onInsertImage}
        generating={aiGenerating}
        improving={aiImproving}
        hasBody={hasBody}
        recipientPartnerId={recipientPartnerId}
        recipientCount={recipientCount}
        contextSummary={contextSummary}
      />

      {editAnalysis && (
        <EmailEditLearningDialog
          open={learningDialogOpen}
          onClose={onCloseLearningDialog}
          analysis={editAnalysis}
          onSendAndSave={onSendAndSave}
          onSendWithoutSaving={onSendWithoutSaving}
        />
      )}
    </div>
  );
}

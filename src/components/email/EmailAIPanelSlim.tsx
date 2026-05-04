/**
 * EmailAIPanelSlim — wraps OraclePanelSlim + EmailEditLearningDialog.
 * Variante del precedente `EmailAIPanel` per il nuovo layout Compose dove
 * tipo/tono/brief/KB vivono nella sidebar filtri sinistra.
 */
import * as React from "react";
import { OraclePanelSlim } from "@/components/email/OraclePanelSlim";
import EmailEditLearningDialog, { type EditAnalysis } from "@/components/email/EmailEditLearningDialog";
import type { OracleConfig } from "@/components/email/OraclePanel";
import type { OracleContextSummary } from "@/components/email/OracleContextPanel";

interface Props {
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

export function EmailAIPanelSlim({
  aiGenerating, aiImproving, hasBody,
  learningDialogOpen, editAnalysis,
  onGenerate, onImprove, onLoadTemplate, onInsertImage,
  onCloseLearningDialog, onSendAndSave, onSendWithoutSaving,
  recipientPartnerId = null, recipientCount = 0, contextSummary = null,
}: Props): React.ReactElement {
  return (
    <div className="w-full h-full min-w-[240px]">
      <OraclePanelSlim
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

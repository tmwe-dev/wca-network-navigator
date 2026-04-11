/**
 * EmailEditorPanel — Subject + HTML editor + variable toolbar
 */
import * as React from "react";
import { useCallback, useState } from "react";
import HtmlEmailEditor from "@/components/email/HtmlEmailEditor";
import { EMAIL_VARIABLES } from "@/v2/hooks/useEmailComposerV2";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Variable, Paperclip, Eye } from "lucide-react";
import DOMPurify from "dompurify";

interface EmailEditorPanelProps {
  readonly subject: string;
  readonly onSubjectChange: (v: string) => void;
  readonly body: string;
  readonly onBodyChange: (v: string) => void;
  readonly recipientName?: string;
  readonly recipientCompany?: string;
  readonly recipientCity?: string;
  readonly recipientCountry?: string;
}

export function EmailEditorPanel({
  subject, onSubjectChange,
  body, onBodyChange,
  recipientName, recipientCompany, recipientCity, recipientCountry,
}: EmailEditorPanelProps): React.ReactElement {
  const [showPreview, setShowPreview] = useState(false);

  const insertVariable = useCallback((key: string) => {
    onBodyChange(body + key);
  }, [body, onBodyChange]);

  const resolveVariables = useCallback((html: string): string => {
    return html
      .replace(/\{\{company_name\}\}/g, recipientCompany ?? "[Azienda]")
      .replace(/\{\{contact_name\}\}/g, recipientName ?? "[Nome]")
      .replace(/\{\{city\}\}/g, recipientCity ?? "[Città]")
      .replace(/\{\{country\}\}/g, recipientCountry ?? "[Paese]");
  }, [recipientName, recipientCompany, recipientCity, recipientCountry]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* Subject */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Oggetto</label>
        <input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Oggetto dell'email"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Variable className="h-3.5 w-3.5" /> Variabili
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {EMAIL_VARIABLES.map((v) => (
              <button
                key={v.key}
                onClick={() => insertVariable(v.key)}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm"
              >
                <code className="text-primary">{v.key}</code>
                <span className="text-muted-foreground ml-2">{v.label}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Button
          variant={showPreview ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="h-3.5 w-3.5" /> Preview
        </Button>
      </div>

      {/* Editor or Preview */}
      {showPreview ? (
        <div className="flex-1 min-h-[200px] max-h-[60vh] overflow-y-auto rounded-md border bg-background p-4">
          <div
            className="prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(resolveVariables(body)),
            }}
          />
        </div>
      ) : (
        <HtmlEmailEditor
          value={body}
          onChange={onBodyChange}
          placeholder="Scrivi il contenuto dell'email..."
          className="flex-1"
        />
      )}
    </div>
  );
}

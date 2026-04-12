/**
 * EmailToolbar — Variables, Links, Attachments, Preview toggle
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Braces, Paperclip, Eye, Plus, X } from "lucide-react";
import { Link as LinkIcon } from "lucide-react";
import { VARIABLES, type LinkItem } from "@/hooks/useEmailComposerState";

interface EmailToolbarProps {
  readonly emailLinks: LinkItem[];
  readonly newLinkLabel: string;
  readonly newLinkUrl: string;
  readonly selectedAttachments: string[];
  readonly previewOpen: boolean;
  readonly templatesByCategory: Record<string, any[]>;
  readonly onInsertVariable: (v: string) => void;
  readonly onAddLink: () => void;
  readonly onRemoveLink: (idx: number) => void;
  readonly onNewLinkLabelChange: (v: string) => void;
  readonly onNewLinkUrlChange: (v: string) => void;
  readonly onToggleAttachment: (id: string) => void;
  readonly onTogglePreview: () => void;
}

export function EmailToolbar({
  emailLinks, newLinkLabel, newLinkUrl, selectedAttachments, previewOpen,
  templatesByCategory, onInsertVariable, onAddLink, onRemoveLink,
  onNewLinkLabelChange, onNewLinkUrlChange, onToggleAttachment, onTogglePreview,
}: EmailToolbarProps): React.ReactElement {
  const hasTemplates = Object.keys(templatesByCategory).length > 0;

  return (
    <div className="flex items-center justify-end gap-1 mb-1.5">
      {/* Variables */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Variabili">
            <Braces className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Inserisci variabile</p>
          <div className="flex flex-col gap-1">
            {VARIABLES.map(v => (
              <button key={v} onClick={() => onInsertVariable(v)}
                className="text-xs text-left px-2 py-1.5 rounded hover:bg-muted/50 font-mono text-primary transition-colors">
                {v}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Links */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" title="Link">
            <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
            {emailLinks.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center">{emailLinks.length}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <p className="text-xs font-medium mb-2">Link da includere</p>
          {emailLinks.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/30 rounded p-1.5 mb-1">
              <span className="truncate flex-1">{l.label}</span>
              <button onClick={() => onRemoveLink(i)} className="p-0.5 hover:bg-destructive/10 rounded">
                <X className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
          <div className="flex gap-1 mt-1.5">
            <Input placeholder="Etichetta" value={newLinkLabel} onChange={e => onNewLinkLabelChange(e.target.value)} className="flex-1 h-7 text-xs" />
            <Input placeholder="https://..." value={newLinkUrl} onChange={e => onNewLinkUrlChange(e.target.value)} className="flex-1 h-7 text-xs" />
            <Button size="sm" variant="outline" className="h-7 px-1.5" onClick={onAddLink}><Plus className="w-3 h-3" /></Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Attachments */}
      {hasTemplates && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" title="Allegati">
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              {selectedAttachments.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center">{selectedAttachments.length}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <p className="text-xs font-medium mb-2">Allegati</p>
            {Object.entries(templatesByCategory).map(([cat, files]) => (
              <div key={cat} className="space-y-0.5">
                {files.map((t: any) => (
                  <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-muted/30">
                    <input type="checkbox" checked={selectedAttachments.includes(t.id)}
                      onChange={() => onToggleAttachment(t.id)}
                      className="h-3.5 w-3.5 rounded" />
                    <span className="truncate">{t.file_name}</span>
                  </label>
                ))}
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {/* Preview toggle */}
      <Button variant={previewOpen ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Anteprima"
        onClick={onTogglePreview}>
        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

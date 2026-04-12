import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code2, Eye } from "lucide-react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

interface HtmlEmailEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const ALLOWED_TAGS = ['p', 'br', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr', 'blockquote', 'pre', 'code', 'sup', 'sub', 'u', 's'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'style', 'class', 'src', 'alt', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'colspan', 'rowspan'];

export default function HtmlEmailEditor({ value, onChange, placeholder, className }: HtmlEmailEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  // Sync external value → contentEditable (only when value changes externally)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editorRef.current && !sourceMode) {
      const sanitized = DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR });
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized;
      }
    }
  }, [value, sourceMode]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleSourceChange = useCallback((raw: string) => {
    onChange(raw);
  }, [onChange]);

  const toggleMode = useCallback(() => {
    setSourceMode(prev => !prev);
  }, []);

  const isEmpty = !value || value === "<br>" || value === "<p><br></p>";

  return (
    <div className={cn("flex flex-col flex-1 relative", className)}>
      {/* Mode toggle */}
      <div className="absolute top-1.5 right-1.5 z-10">
        <Button
          variant={sourceMode ? "secondary" : "ghost"}
          size="sm"
          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
          title={sourceMode ? "Modalità visuale" : "Modalità sorgente HTML"}
          onClick={toggleMode}
        >
          {sourceMode ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
        </Button>
      </div>

      {sourceMode ? (
        <Textarea
          value={value}
          onChange={(e) => handleSourceChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-h-[200px] max-h-[60vh] h-full text-xs font-mono bg-muted/10 resize-none border-border focus:border-primary/50 overflow-y-auto"
        />
      ) : (
        <div className="relative flex-1 min-h-[200px] max-h-[60vh]">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            className={cn(
              "w-full h-full min-h-[200px] max-h-[60vh] rounded-md border border-input bg-background px-4 py-3 text-sm",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "overflow-y-auto",
              "prose prose-sm max-w-none",
              "prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5",
              "prose-a:text-primary prose-strong:text-foreground",
              "[&_*]:text-foreground/80",
              isEmpty && "empty-editor"
            )}
            style={{ minHeight: 200 }}
            data-placeholder={placeholder}
          />
          {isEmpty && (
            <div className="absolute top-3 left-4 text-sm text-muted-foreground pointer-events-none select-none">
              {placeholder}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

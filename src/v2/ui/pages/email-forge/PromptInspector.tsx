/**
 * PromptInspector — central panel of Email Forge.
 * Shows system + user prompt as labeled, collapsible blocks.
 */
import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { PromptBlock } from "@/v2/hooks/useEmailForge";

interface Props {
  systemPrompt?: string;
  userPrompt?: string;
  systemBlocks?: PromptBlock[];
  blocks?: PromptBlock[];
  isLoading: boolean;
}

function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function BlockList({ blocks }: { blocks: PromptBlock[] }) {
  return (
    <Accordion type="multiple" className="space-y-1">
      {blocks.map((b, idx) => (
        <AccordionItem
          key={`${b.label}-${idx}`}
          value={`${b.label}-${idx}`}
          className="border border-border/40 rounded-md bg-card px-2"
        >
          <AccordionTrigger className="py-2 hover:no-underline">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono text-[10px]">
                {idx + 1}
              </Badge>
              <span className="font-medium">{b.label}</span>
              <span className="text-muted-foreground">
                · {b.content.length.toLocaleString()} char
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed bg-muted/40 p-2 rounded font-mono text-foreground/90 max-h-96 overflow-auto">
              {b.content || "(vuoto)"}
            </pre>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function PromptInspector({ systemPrompt, userPrompt, systemBlocks, blocks, isLoading }: Props) {
  const fullPrompt = `=== SYSTEM ===\n${systemPrompt ?? ""}\n\n=== USER ===\n${userPrompt ?? ""}`;
  const handleCopy = async () => {
    if (!systemPrompt && !userPrompt) return;
    await navigator.clipboard.writeText(fullPrompt);
    toast.success("Prompt copiato negli appunti");
  };
  const handleDownload = () => {
    if (!systemPrompt && !userPrompt) return;
    downloadTxt(`email-forge-prompt-${Date.now()}.txt`, fullPrompt);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground gap-2">
        <Sparkles className="w-4 h-4 animate-pulse" />
        Costruzione prompt in corso…
      </div>
    );
  }

  if (!systemBlocks?.length && !blocks?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground p-6">
        <FileText className="w-10 h-10 mb-3 opacity-40" />
        <p className="font-medium">Nessun prompt ancora generato</p>
        <p className="text-xs mt-1 max-w-xs">
          Configura le scelte nel pannello Oracolo a sinistra e clicca <strong>Genera</strong> per
          ispezionare i blocchi che compongono il prompt.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <div className="text-xs font-medium flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          Prompt assemblato ·{" "}
          <span className="text-muted-foreground">
            {(systemBlocks?.length ?? 0) + (blocks?.length ?? 0)} blocchi · {fullPrompt.length.toLocaleString()} char
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDownload} className="h-7 px-2">
            <Download className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {systemBlocks && systemBlocks.length > 0 && (
          <section>
            <h3 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[9px]">SYSTEM</Badge>
              Identità + guardrails
            </h3>
            <BlockList blocks={systemBlocks} />
          </section>
        )}

        {blocks && blocks.length > 0 && (
          <section>
            <h3 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary border-0 text-[9px]">USER</Badge>
              Contesto dinamico (in ordine)
            </h3>
            <BlockList blocks={blocks} />
          </section>
        )}
      </div>
    </div>
  );
}

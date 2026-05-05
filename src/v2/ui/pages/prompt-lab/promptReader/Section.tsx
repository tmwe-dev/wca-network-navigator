import * as React from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Section({
  title, meta, children, onCopy,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  onCopy?: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary truncate">{title}</h3>
          {meta && <span className="text-[10px] text-muted-foreground truncate">{meta}</span>}
        </div>
        {onCopy && (
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]" onClick={onCopy}>
            <Copy className="h-3 w-3" /> Copia
          </Button>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
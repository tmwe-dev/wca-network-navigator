/**
 * Terminal — Log display component for extension tests
 */
import { useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface LogEntry {
  ts: string;
  msg: string;
  type: "info" | "ok" | "warn" | "error";
}

export function ts(): string {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const colorMap: Record<LogEntry["type"], string> = {
  info: "text-muted-foreground",
  ok: "text-green-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

export function Terminal({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  return (
    <ScrollArea className="h-[400px] rounded-lg border border-border bg-card p-4 font-mono text-xs">
      {logs.length === 0 && (
        <p className="text-muted-foreground">Premi un pulsante per iniziare...</p>
      )}
      {logs.map((l, i) => (
        <div key={i} className={colorMap[l.type]}>
          <span className="text-muted-foreground/60">[{l.ts}]</span> {l.msg}
        </div>
      ))}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}

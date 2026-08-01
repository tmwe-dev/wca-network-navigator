import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SenderCard } from "../management/SenderCard";
import type { SenderAnalysis, EmailSenderGroup } from "@/types/email-management";

/**
 * Renderizza solo le card visibili (overscan 6) per gestire >1000 mittenti.
 */
export function VirtualizedSenderList(props: {
  senders: SenderAnalysis[];
  groups: EmailSenderGroup[];
  selectedEmails: Set<string>;
  focusedEmail: string | null;
  onDragStart: (s: SenderAnalysis) => void;
  onDragEnd: (clientX: number, clientY: number) => void;
  onToggleSelect: (email: string) => void;
  onAiChipClick: (groupName: string) => void;
  onFocusRequest: (s: SenderAnalysis) => void;
  onOpenRules: (s: SenderAnalysis) => void;
  onMarkRead: (s: SenderAnalysis) => Promise<void> | void;
  onDelete: (s: SenderAnalysis) => Promise<void> | void;
  onExport: (s: SenderAnalysis) => void;
  onBlock: (s: SenderAnalysis) => Promise<void> | void;
  onAnalyzeAI: (s: SenderAnalysis) => void;
  onAcceptAiSuggestion: (s: SenderAnalysis, groupName: string) => Promise<void> | void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: props.senders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 188,
    overscan: 6,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {items.map((vi) => {
          const sender = props.senders[vi.index];
          return (
            <div
              key={sender.email}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
                paddingBottom: 8,
              }}
            >
              <SenderCard
                sender={sender}
                groups={props.groups}
                onDragStart={props.onDragStart}
                onDragEnd={props.onDragEnd}
                isSelected={props.selectedEmails.has(sender.email)}
                onToggleSelect={props.onToggleSelect}
                onAiChipClick={props.onAiChipClick}
                isFocused={props.focusedEmail === sender.email}
                onFocusRequest={props.onFocusRequest}
                onOpenRules={props.onOpenRules}
                onMarkRead={props.onMarkRead}
                onDelete={props.onDelete}
                onExport={props.onExport}
                onBlock={props.onBlock}
                onAnalyzeAI={props.onAnalyzeAI}
                onAcceptAiSuggestion={props.onAcceptAiSuggestion}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
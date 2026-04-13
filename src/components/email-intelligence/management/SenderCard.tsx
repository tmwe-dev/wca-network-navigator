/**
 * SenderCard — Draggable sender card (ported from tmwengine)
 */
import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SenderAnalysis } from '@/types/email-management';

interface SenderCardProps {
  sender: SenderAnalysis;
  onDragStart?: (sender: SenderAnalysis) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  onDoubleClick?: (sender: SenderAnalysis) => void;
}

export function SenderCard({ sender, onDragStart, onDragEnd, onDoubleClick }: SenderCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    onDragStart?.(sender);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(sender));
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    onDragEnd?.(e.clientX, e.clientY);
  };

  return (
    <div
      ref={cardRef}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn("snap-start", isDragging && "opacity-30")}
    >
      <Card
        onDoubleClick={() => onDoubleClick?.(sender)}
        className={cn(
          "border-l-4 transition-shadow cursor-grab",
          !isDragging && "hover:scale-[1.02]",
          sender.emailCount > 100
            ? "border-l-destructive"
            : sender.emailCount > 50
              ? "border-l-orange-500"
              : "border-l-primary/40",
          isDragging && "cursor-grabbing"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <GripVertical className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg truncate mb-1">{sender.companyName}</div>
                <div className="text-sm text-muted-foreground truncate">{sender.email}</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-primary flex-shrink-0">{sender.emailCount}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

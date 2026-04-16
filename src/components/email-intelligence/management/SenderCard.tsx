/**
 * SenderCard — Draggable sender card with domain favicon, country flag, email preview
 */
import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GripVertical, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFlagFromDomain, getDomainFaviconUrl } from '@/lib/domainUtils';
import type { SenderAnalysis } from '@/types/email-management';

interface SenderCardProps {
  sender: SenderAnalysis;
  onDragStart?: (sender: SenderAnalysis) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  onDoubleClick?: (sender: SenderAnalysis) => void;
  onViewEmails?: (sender: SenderAnalysis) => void;
}

export function SenderCard({ sender, onDragStart, onDragEnd, onDoubleClick, onViewEmails }: SenderCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const flag = getFlagFromDomain(sender.domain);
  const faviconUrl = getDomainFaviconUrl(sender.domain);

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
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* Favicon */}
            {faviconUrl && !faviconError ? (
              <img
                src={faviconUrl}
                alt=""
                className="h-5 w-5 rounded-sm flex-shrink-0 object-contain"
                loading="lazy"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <div className="h-5 w-5 rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {sender.domain?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
            )}

            {/* Flag */}
            {flag && (
              <span className="text-base flex-shrink-0" title={sender.domain}>
                {flag}
              </span>
            )}

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{sender.companyName}</div>
              <div className="text-[11px] text-muted-foreground truncate">{sender.email}</div>
            </div>

            {/* Email count */}
            <span className="text-lg font-bold text-primary flex-shrink-0">{sender.emailCount}</span>

            {/* View emails button */}
            {onViewEmails && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewEmails(sender); }}
                className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                title="Visualizza email"
                draggable={false}
              >
                <Mail className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

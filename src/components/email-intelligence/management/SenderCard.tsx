/**
 * SenderCard — Draggable sender card with domain favicon, country flag, email preview, and group assignment dropdown
 */
import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GripVertical, Mail, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getFlagFromDomain, getDomainFaviconUrl } from '@/lib/domainUtils';
import type { SenderAnalysis, EmailSenderGroup } from '@/types/email-management';
import { toast } from 'sonner';

interface SenderCardProps {
  sender: SenderAnalysis;
  onDragStart?: (sender: SenderAnalysis) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  onDoubleClick?: (sender: SenderAnalysis) => void;
  onViewEmails?: (sender: SenderAnalysis) => void;
  groups?: EmailSenderGroup[];
  onAssignGroup?: (sender: SenderAnalysis, groupName: string, groupId: string) => Promise<void>;
}

export function SenderCard({ sender, onDragStart, onDragEnd, onDoubleClick, onViewEmails, groups = [], onAssignGroup }: SenderCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
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

  const handleGroupSelection = async () => {
    if (!selectedGroupId || !onAssignGroup) return;
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    setIsAssigning(true);
    try {
      await onAssignGroup(sender, group.nome_gruppo, group.id);
      setSelectedGroupId("");
    } catch (err) {
      toast.error("Errore assegnazione");
    } finally {
      setIsAssigning(false);
    }
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
        <CardContent className="p-3 flex flex-col gap-2">
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

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{sender.companyName}</div>
              <div className="text-[11px] text-muted-foreground truncate">{sender.email}</div>
            </div>

            {/* Email count + flag column */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <span className="text-lg font-bold text-primary">{sender.emailCount}</span>
              {flag && (
                <span className="text-xl leading-none" title={sender.domain}>
                  {flag}
                </span>
              )}
            </div>

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

          {/* Group assignment dropdown */}
          {groups && groups.length > 0 && onAssignGroup && (
            <div className="flex items-center gap-1.5">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Assegna gruppo…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <span className="mr-2">{group.icon || '📁'}</span>
                      {group.nome_gruppo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedGroupId && (
                <Button
                  size="icon"
                  variant="default"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleGroupSelection(); }}
                  disabled={isAssigning}
                  title="Conferma assegnazione"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

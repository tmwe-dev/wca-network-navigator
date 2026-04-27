/**
 * SenderCard — Card compatta per un sender email.
 *
 * Refactor: rimossi dropdown "Assegna gruppo", "Più opzioni" inline e tutti
 * i sotto-pannelli (PromptTemplateSelector, RulesConfiguration, BulkEmailActions).
 * Quelle azioni vivono ora nella SenderActionBar (selezione multipla) o via
 * drag&drop sui gruppi. La card mostra solo: avatar, nome, email, conteggio,
 * bandiera, chip AI suggerimento, badge "classificato".
 */
import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Mail, Sparkles, Check, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getFlagFromDomain, getDomainFaviconUrl } from '@/lib/domainUtils';
import type { SenderAnalysis } from '@/types/email-management';

interface SenderCardProps {
  sender: SenderAnalysis;
  onDragStart?: (sender: SenderAnalysis) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  onDoubleClick?: (sender: SenderAnalysis) => void;
  onViewEmails?: (sender: SenderAnalysis) => void;
  isSelected?: boolean;
  /** Se true mostra checkbox di multi-selezione. */
  multiSelectMode?: boolean;
  onToggleSelect?: (email: string) => void;
  /** Click sul chip AI suggerimento → segnala il group_name al parent (highlight). */
  onAiChipClick?: (groupName: string) => void;
  /** Card "in focus" per il preview panel (sostituisce il visual di selezione singola). */
  isFocused?: boolean;
}

export function SenderCard({
  sender,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  onViewEmails,
  isSelected = false,
  multiSelectMode = false,
  onToggleSelect,
  onAiChipClick,
  isFocused = false,
}: SenderCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const flag = getFlagFromDomain(sender.domain);
  const faviconUrl = getDomainFaviconUrl(sender.domain);

  // Iniziali fallback: 2 lettere uppercase del companyName.
  const initials = (() => {
    const parts = (sender.companyName || sender.email || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  })();

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
      className={cn("snap-start relative", isDragging && "opacity-30")}
    >
      {/* Ribbon "Selezionato" che sporge sopra la card quando in focus */}
      {isFocused && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold shadow-sm whitespace-nowrap">
            ● Selezionato
          </span>
        </div>
      )}
      <Card
        onDoubleClick={() => onDoubleClick?.(sender)}
        className={cn(
          "border-l-4 transition-all cursor-grab",
          !isDragging && "hover:shadow-md",
          // Focus visivo (preview): ring sottile, NESSUNA opacità ridotta.
          isFocused && "ring-2 ring-primary shadow-md",
          isSelected && "border-2 border-primary bg-primary/5",
          sender.emailCount > 100
            ? "border-l-destructive"
            : sender.emailCount > 50
              ? "border-l-orange-500"
              : "border-l-primary/40",
          isDragging && "cursor-grabbing"
        )}
      >
        <CardContent className="p-2.5 flex flex-col gap-1.5">
          {/* Riga 1: checkbox (solo multi) + grip + avatar + nome/email + conteggio */}
          <div className="flex items-center gap-1.5">
            {multiSelectMode && onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(sender.email)}
                onClick={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5 flex-shrink-0"
              />
            )}
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

            {/* Avatar: favicon → fallback iniziali */}
            {faviconUrl && !faviconError ? (
              <img
                src={faviconUrl}
                alt=""
                className="h-5 w-5 rounded-sm flex-shrink-0 object-contain"
                loading="lazy"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-primary leading-none">{initials}</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs truncate text-foreground">{sender.companyName}</div>
              <div className="text-[10px] text-muted-foreground truncate">{sender.email}</div>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className="text-base font-bold text-primary leading-none">{sender.emailCount}</span>
              {flag && (
                <span className="text-sm leading-none" title={sender.domain}>
                  {flag}
                </span>
              )}
            </div>
          </div>

          {/* Riga 2: chip AI + badge classificato + view emails */}
          <div className="flex items-center gap-1 min-h-[18px]">
            {sender.aiSuggestion?.group_name && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAiChipClick?.(sender.aiSuggestion!.group_name);
                }}
                draggable={false}
                title={`Suggerimento AI (confidenza ${Math.round((sender.aiSuggestion.confidence ?? 0) * 100)}%)`}
              >
                <Badge
                  variant="default"
                  className="gap-1 text-[10px] py-0.5 h-5 px-2 bg-primary/90 hover:bg-primary transition-colors shadow-sm"
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="font-semibold truncate max-w-[100px]">
                    AI: {sender.aiSuggestion.group_name}
                  </span>
                </Badge>
              </button>
            )}
            {!sender.aiSuggestion?.group_name && !sender.isClassified && (
              <span className="text-[9px] text-muted-foreground/60 italic">
                Nessun suggerimento AI
              </span>
            )}
            {sender.isClassified && (
              <Badge
                variant="secondary"
                className="gap-0.5 text-[9px] py-0 h-4 px-1.5"
                title={sender.currentGroup?.nome_gruppo || "Classificato"}
              >
                <Check className="h-2.5 w-2.5" />
                <span className="truncate max-w-[70px]">
                  {sender.currentGroup?.nome_gruppo || "Classificato"}
                </span>
              </Badge>
            )}
            {onViewEmails && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewEmails(sender); }}
                className="ml-auto p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                title="Visualizza email"
                draggable={false}
              >
                <Mail className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Riga 3: ultima email ricevuta */}
          {sender.lastSeen && (
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground/80 pt-0.5 border-t border-border/40">
              <Clock className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">
                Ultima: {new Date(sender.lastSeen).toLocaleDateString("it-IT", {
                  day: "2-digit", month: "short", year: "2-digit",
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

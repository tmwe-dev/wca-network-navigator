/**
 * SenderCard — Card sender ampliata e card-centrica.
 *
 * Tutte le azioni (Regole, Segna lette, Elimina, Esporta, Blocca, AI)
 * sono dentro la card come icon-button con tooltip. Niente più barra
 * azioni esterna. Multi-selezione tramite checkbox sempre visibile.
 *
 * Layout (240px × ~190px):
 *  Riga 1: ☑ + logo + nome + count
 *  Riga 2: bandiera + email
 *  Riga 3: chip AI suggerimento (con bottone "associa subito")
 *  Riga 4: badge classificato (se applicabile)
 *  Riga 5: ultima email
 *  Riga 6: 6 icone azioni rapide
 */
import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  GripVertical, Sparkles, Check, Clock, ArrowRight,
  Settings2, MailCheck, Trash2, Download, Ban, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { getFlagFromDomain, getDomainFaviconUrl } from '@/lib/domainUtils';
import type { SenderAnalysis } from '@/types/email-management';

interface SenderCardProps {
  sender: SenderAnalysis;
  onDragStart?: (sender: SenderAnalysis) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  isSelected?: boolean;
  onToggleSelect?: (email: string) => void;
  /** Click sul chip AI suggerimento → segnala il group_name al parent (highlight). */
  onAiChipClick?: (groupName: string) => void;
  /** Card "in focus" per il preview panel (ring sottile). */
  isFocused?: boolean;
  /** Click sulla card → focus per preview email. */
  onFocusRequest?: (sender: SenderAnalysis) => void;
  /** 6 azioni rapide (parent gestisce business logic). */
  onOpenRules?: (sender: SenderAnalysis) => void;
  onMarkRead?: (sender: SenderAnalysis) => Promise<void> | void;
  onDelete?: (sender: SenderAnalysis) => Promise<void> | void;
  onExport?: (sender: SenderAnalysis) => void;
  onBlock?: (sender: SenderAnalysis) => Promise<void> | void;
  onAnalyzeAI?: (sender: SenderAnalysis) => void;
  /** "Associa subito al gruppo suggerito dall'AI". */
  onAcceptAiSuggestion?: (sender: SenderAnalysis, groupName: string) => Promise<void> | void;
}

export function SenderCard({
  sender,
  onDragStart,
  onDragEnd,
  isSelected = false,
  onToggleSelect,
  onAiChipClick,
  isFocused = false,
  onFocusRequest,
  onOpenRules,
  onMarkRead,
  onDelete,
  onExport,
  onBlock,
  onAnalyzeAI,
  onAcceptAiSuggestion,
}: SenderCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const flag = getFlagFromDomain(sender.domain);
  const faviconUrl = getDomainFaviconUrl(sender.domain);

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

  // Wrapper async per le azioni con stato busy.
  const runAction = async (key: string, fn?: (s: SenderAnalysis) => Promise<void> | void) => {
    if (!fn) return;
    setBusy(key);
    try {
      await fn(sender);
    } finally {
      setBusy(null);
    }
  };

  // Stop propagation comune per evitare focus-on-click + drag interference.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => onFocusRequest?.(sender)}
        className={cn("snap-start relative", isDragging && "opacity-30")}
      >
        {/* Ribbon "Selezionato" sopra la card quando è in focus */}
        {isFocused && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold shadow-sm whitespace-nowrap">
              ● Selezionato
            </span>
          </div>
        )}

        <Card
          className={cn(
            "border-l-4 transition-all cursor-grab",
            !isDragging && "hover:shadow-md",
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
          <CardContent className="p-3 flex flex-col gap-2">
            {/* Riga 1: checkbox + grip + logo + nome + count */}
            <div className="flex items-center gap-2">
              {onToggleSelect && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(sender.email)}
                  onClick={stop}
                  className="h-4 w-4 flex-shrink-0"
                  aria-label="Seleziona mittente"
                />
              )}
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

              {faviconUrl && !faviconError ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="h-6 w-6 rounded-sm flex-shrink-0 object-contain"
                  loading="lazy"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-primary leading-none">{initials}</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate text-foreground">
                  {sender.companyName}
                </div>
              </div>

              <span className="text-lg font-bold text-primary leading-none flex-shrink-0">
                {sender.emailCount}
              </span>
            </div>

            {/* Riga 2: bandiera + email */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground -mt-1">
              {flag && (
                <span className="text-sm leading-none flex-shrink-0" title={sender.domain}>
                  {flag}
                </span>
              )}
              <span className="truncate">{sender.email}</span>
            </div>

            {/* Riga 3: chip AI suggerimento + "associa subito" */}
            {sender.aiSuggestion?.group_name ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    onAiChipClick?.(sender.aiSuggestion!.group_name);
                  }}
                  draggable={false}
                  title={`Suggerimento AI (confidenza ${Math.round((sender.aiSuggestion.confidence ?? 0) * 100)}%)`}
                  className="flex-1 min-w-0"
                >
                  <Badge
                    variant="default"
                    className="gap-1 text-[10px] py-0.5 h-5 px-2 bg-primary/90 hover:bg-primary transition-colors shadow-sm w-full justify-start"
                  >
                    <Sparkles className="h-3 w-3 flex-shrink-0" />
                    <span className="font-semibold truncate">
                      AI: {sender.aiSuggestion.group_name}
                    </span>
                  </Badge>
                </button>
                {onAcceptAiSuggestion && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={(e) => {
                          stop(e);
                          runAction("ai-accept", () =>
                            onAcceptAiSuggestion(sender, sender.aiSuggestion!.group_name),
                          );
                        }}
                        disabled={busy !== null}
                        draggable={false}
                      >
                        {busy === "ai-accept" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Associa subito al gruppo suggerito</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ) : (
              <span className="text-[9px] text-muted-foreground/60 italic">
                Nessun suggerimento AI
              </span>
            )}

            {/* Riga 4: badge classificato (se presente) */}
            {sender.isClassified && (
              <Badge
                variant="secondary"
                className="gap-0.5 text-[9px] py-0 h-4 px-1.5 self-start"
                title={sender.currentGroup?.nome_gruppo || "Classificato"}
              >
                <Check className="h-2.5 w-2.5" />
                <span className="truncate max-w-[140px]">
                  {sender.currentGroup?.nome_gruppo || "Classificato"}
                </span>
              </Badge>
            )}

            {/* Riga 5: ultima email */}
            {sender.lastSeen && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground/80">
                <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">
                  Ultima: {new Date(sender.lastSeen).toLocaleDateString("it-IT", {
                    day: "2-digit", month: "short", year: "2-digit",
                  })}
                </span>
              </div>
            )}

            {/* Riga 6: icon-button azioni rapide */}
            <div className="flex items-center justify-between gap-0.5 pt-1.5 border-t border-border/40">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={(e) => { stop(e); onOpenRules?.(sender); }}
                    draggable={false}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regole automatiche</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={(e) => { stop(e); runAction("mark_read", onMarkRead); }}
                    disabled={busy !== null}
                    draggable={false}
                  >
                    {busy === "mark_read" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MailCheck className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Segna come letto</TooltipContent>
              </Tooltip>

              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                        onClick={stop}
                        disabled={busy !== null}
                        draggable={false}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Elimina mail di questo mittente</TooltipContent>
                </Tooltip>
                <AlertDialogContent onClick={stop}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Impostare regola di eliminazione?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Per <strong>{sender.companyName}</strong> l'azione automatica diventerà
                      <strong> "elimina"</strong>. Le mail future verranno spostate nel cestino al
                      prossimo ciclo di sincronizzazione.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => { e.preventDefault(); runAction("delete", onDelete); }}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Conferma
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={(e) => { stop(e); onExport?.(sender); }}
                    draggable={false}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Esporta CSV</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                    onClick={(e) => { stop(e); runAction("block", onBlock); }}
                    disabled={busy !== null}
                    draggable={false}
                  >
                    {busy === "block" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Ban className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Blocca mittente (spam)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary"
                    onClick={(e) => { stop(e); onAnalyzeAI?.(sender); }}
                    draggable={false}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Analizza con AI</TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

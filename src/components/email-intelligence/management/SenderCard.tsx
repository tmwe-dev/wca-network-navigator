/**
 * SenderCard — Card sender VERTICALE leggibile (v4, 2026-04-27).
 *
 * v4 (richiesta utente): card più corta e ordinata.
 *  - Logo a sinistra, nome azienda + email subito a destra (in colonna).
 *  - "Ultima: …" sotto.
 *  - Suggerimento AI (se presente).
 *  - Footer in basso: checkbox + grip a sinistra, contatore al centro,
 *    bottoni "Azioni & regole" (apre dialog) + "AI" a destra.
 *
 * In questa fase NON mostriamo "Elimina" e "Blocca" sulla card: sono azioni
 * distruttive che faremo in batch dal server in una fase successiva.
 * Tutte le azioni di organizzazione (mark-read, archive, sposta in cartella,
 * spam, esporta, prompt regola custom) sono raccolte nella popup
 * `SenderActionsDialog` aperta dal bottone "Azioni & regole".
 */
import { memo, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  GripVertical, Sparkles, Check, Clock, ArrowRight, Wand2, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getFlagFromDomain, getDomainFaviconUrl } from '@/lib/domainUtils';
import type { SenderAnalysis } from '@/types/email-management';
import { SenderActionsDialog } from './SenderActionsDialog';

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
  /**
   * Callback opzionali (compat back). Le 4 destructive non sono più
   * mostrate sulla card; restano disponibili per la dialog/parent se servono.
   */
  onOpenRules?: (sender: SenderAnalysis) => void;
  onMarkRead?: (sender: SenderAnalysis) => Promise<void> | void;
  onDelete?: (sender: SenderAnalysis) => Promise<void> | void;
  onExport?: (sender: SenderAnalysis) => void;
  onBlock?: (sender: SenderAnalysis) => Promise<void> | void;
  onAnalyzeAI?: (sender: SenderAnalysis) => void;
  /** "Associa subito al gruppo suggerito dall'AI". */
  onAcceptAiSuggestion?: (sender: SenderAnalysis, groupName: string) => Promise<void> | void;
  /** Notifica al parent che è stata applicata una regola dalla dialog. */
  onActionComplete?: () => void;
}

function SenderCardImpl({
  sender,
  onDragStart,
  onDragEnd,
  isSelected = false,
  onToggleSelect,
  onAiChipClick,
  isFocused = false,
  onFocusRequest,
  onAnalyzeAI,
  onAcceptAiSuggestion,
  onActionComplete,
}: SenderCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
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
            <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm whitespace-nowrap">
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
                ? "border-l-primary"
                : "border-l-primary/40",
            isDragging && "cursor-grabbing"
          )}
        >
          <CardContent className="p-3 flex flex-col gap-2">
            {/* HEADER: logo + (nome azienda / email + bandiera) */}
            <div className="flex items-start gap-2.5">
              {faviconUrl && !faviconError ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="h-10 w-10 rounded-md flex-shrink-0 object-contain bg-background border border-border/50"
                  loading="lazy"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary leading-none">{initials}</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div
                  className="font-semibold text-sm text-foreground leading-snug break-words"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                  title={sender.companyName}
                >
                  {sender.companyName}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-foreground/70 mt-0.5">
                  {flag && (
                    <span className="text-sm leading-none flex-shrink-0" title={sender.domain}>
                      {flag}
                    </span>
                  )}
                  <span className="truncate" title={sender.email}>{sender.email}</span>
                </div>
              </div>
            </div>

            {/* ULTIMA email — label esplicita, leggibile */}
            {sender.lastSeen && (
              <div className="flex items-center gap-1.5 text-[11px] text-foreground/60">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>
                  Ultima:{" "}
                  <span className="text-foreground/80 font-medium">
                    {new Date(sender.lastSeen).toLocaleDateString("it-IT", {
                      day: "2-digit", month: "short", year: "2-digit",
                    })}
                  </span>
                </span>
              </div>
            )}

            {/* AI SUGGERIMENTO — visibile e cliccabile */}
            {sender.aiSuggestion?.group_name ? (
              <div className="flex items-stretch gap-1.5 mt-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    onAiChipClick?.(sender.aiSuggestion!.group_name);
                  }}
                  draggable={false}
                  title={`Suggerimento AI (confidenza ${Math.round((sender.aiSuggestion.confidence ?? 0) * 100)}%) — clicca per evidenziare il gruppo`}
                  className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/15 hover:bg-primary/25 border border-primary/30 transition-colors text-left"
                >
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-primary/80 leading-none">
                      Suggerito AI
                    </div>
                    <div className="text-xs font-semibold text-foreground truncate leading-tight mt-0.5">
                      {sender.aiSuggestion.group_name}
                    </div>
                  </div>
                </button>
                {onAcceptAiSuggestion && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="default"
                        className="h-auto w-8 flex-shrink-0"
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
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Associa al gruppo suggerito</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ) : null}

            {/* Badge classificato */}
            {sender.isClassified && (
              <Badge
                variant="secondary"
                className="gap-1 text-[10px] py-0.5 h-5 px-2 self-start"
                title={sender.currentGroup?.nome_gruppo || "Classificato"}
              >
                <Check className="h-3 w-3" />
                <span className="truncate max-w-[180px]">
                  {sender.currentGroup?.nome_gruppo || "Classificato"}
                </span>
              </Badge>
            )}

            {/* FOOTER: select + grip + counter + bottoni primari */}
            <div className="flex items-center gap-2 pt-2 mt-1 border-t border-border/40">
              {onToggleSelect && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(sender.email)}
                  onClick={stop}
                  className="h-4 w-4 flex-shrink-0"
                  aria-label="Seleziona mittente"
                />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />
                </TooltipTrigger>
                <TooltipContent>Trascina per assegnare a un gruppo</TooltipContent>
              </Tooltip>

              <div className="flex items-baseline gap-1 flex-1 min-w-0">
                <span className="text-base font-bold text-primary leading-none">
                  {sender.emailCount}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  email
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 px-2.5 gap-1"
                    onClick={(e) => { stop(e); setActionsOpen(true); }}
                    draggable={false}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Azioni</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Azioni e regole (mark, sposta, spam, prompt…)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={(e) => { stop(e); onAnalyzeAI?.(sender); }}
                    draggable={false}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">AI</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Suggerimento AI per questo sender</TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>

        {/* Dialog montato solo quando l'utente lo apre — evita migliaia di
         *  Radix Portal montati in lista. */}
        {actionsOpen && (
          <SenderActionsDialog
            sender={sender}
            open={actionsOpen}
            onOpenChange={setActionsOpen}
            onActionDone={onActionComplete}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Memoized export: la lista mittenti rendea ~1 200 card; senza memo ogni
 * cambio di stato del parent (selezione, hover, drag) ne rerenderizza tutte.
 */
export const SenderCard = memo(SenderCardImpl, (prev, next) =>
  prev.sender === next.sender
  && prev.isSelected === next.isSelected
  && prev.isFocused === next.isFocused
  && prev.onDragStart === next.onDragStart
  && prev.onDragEnd === next.onDragEnd
  && prev.onToggleSelect === next.onToggleSelect
  && prev.onAiChipClick === next.onAiChipClick
  && prev.onFocusRequest === next.onFocusRequest
  && prev.onOpenRules === next.onOpenRules
  && prev.onMarkRead === next.onMarkRead
  && prev.onDelete === next.onDelete
  && prev.onExport === next.onExport
  && prev.onBlock === next.onBlock
  && prev.onAnalyzeAI === next.onAnalyzeAI
  && prev.onAcceptAiSuggestion === next.onAcceptAiSuggestion
  && prev.onActionComplete === next.onActionComplete);


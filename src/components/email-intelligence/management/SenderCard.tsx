/**
 * SenderCard — Card sender VERTICALE leggibile (v3, 2026-04-27).
 *
 * Pensata per essere mostrata in colonna verticale stretta (~260-320px)
 * con tutto lo spazio verticale necessario. Niente più troncamenti
 * brutali sul nome azienda e niente più grigio chiaro su scuro per
 * informazioni importanti.
 *
 * Layout verticale (full width della colonna):
 *  - Header: ☑ + logo grande + N° email a destra
 *  - Nome azienda su 2 righe, font sm/base, text-foreground
 *  - Email + bandiera, text-foreground/80
 *  - "Ultima: …" con label esplicita
 *  - Chip AI suggerimento (se presente) con CTA "Associa"
 *  - Badge classificato (se presente)
 *  - Riga azioni primarie con LABEL accanto a ogni icona
 *  - Menu più piccolo per azioni distruttive
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
                ? "border-l-orange-500"
                : "border-l-primary/40",
            isDragging && "cursor-grabbing"
          )}
        >
          <CardContent className="p-3 flex flex-col gap-2.5">
            {/* HEADER: checkbox + grip + logo + counter */}
            <div className="flex items-start gap-2">
              {onToggleSelect && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(sender.email)}
                  onClick={stop}
                  className="h-4 w-4 flex-shrink-0 mt-0.5"
                  aria-label="Seleziona mittente"
                />
              )}
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />

              {faviconUrl && !faviconError ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="h-8 w-8 rounded-sm flex-shrink-0 object-contain bg-background"
                  loading="lazy"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <div className="h-8 w-8 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary leading-none">{initials}</span>
                </div>
              )}

              <div className="flex-1 min-w-0" />

              <div className="flex flex-col items-end leading-tight flex-shrink-0">
                <span className="text-xl font-bold text-primary leading-none">
                  {sender.emailCount}
                </span>
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">
                  email
                </span>
              </div>
            </div>

            {/* NOME AZIENDA — full, max 2 righe, font leggibile */}
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

            {/* EMAIL + bandiera */}
            <div className="flex items-center gap-1.5 text-xs text-foreground/70">
              {flag && (
                <span className="text-sm leading-none flex-shrink-0" title={sender.domain}>
                  {flag}
                </span>
              )}
              <span className="truncate" title={sender.email}>{sender.email}</span>
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

            {/* AZIONI — icone con LABEL leggibili */}
            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border/40">
              <ActionButton
                icon={<Settings2 className="h-3.5 w-3.5" />}
                label="Regole"
                onClick={(e) => { stop(e); onOpenRules?.(sender); }}
              />
              <ActionButton
                icon={busy === "mark_read" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailCheck className="h-3.5 w-3.5" />}
                label="Letta"
                onClick={(e) => { stop(e); runAction("mark_read", onMarkRead); }}
                disabled={busy !== null}
              />
              <ActionButton
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="AI"
                onClick={(e) => { stop(e); onAnalyzeAI?.(sender); }}
                accent
              />
              <ActionButton
                icon={<Download className="h-3.5 w-3.5" />}
                label="Esporta"
                onClick={(e) => { stop(e); onExport?.(sender); }}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    onClick={stop}
                    disabled={busy !== null}
                    draggable={false}
                    className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-md hover:bg-destructive/15 hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-medium leading-none">Elimina</span>
                  </button>
                </AlertDialogTrigger>
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
              <ActionButton
                icon={busy === "block" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                label="Blocca"
                onClick={(e) => { stop(e); runAction("block", onBlock); }}
                disabled={busy !== null}
                destructive
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

// Bottone azione standardizzato: icona + label leggibile sotto.
function ActionButton({
  icon, label, onClick, disabled, accent, destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  accent?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      draggable={false}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-md transition-colors disabled:opacity-50",
        accent
          ? "text-primary hover:bg-primary/15"
          : destructive
            ? "hover:bg-destructive/15 hover:text-destructive"
            : "hover:bg-muted text-foreground/80 hover:text-foreground",
      )}
    >
      {icon}
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}

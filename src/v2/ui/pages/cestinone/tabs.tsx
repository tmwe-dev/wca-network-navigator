import * as React from "react";
import DOMPurify from "dompurify";
import {
  Mail, Megaphone, ArrowUpRight, Bot, IdCard, FileText, Pencil, Sparkles,
  MapPin, Calendar, Send, ShieldCheck, Search, AlertOctagon, Building2, Globe, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";
import type { CestinoItem } from "@/data/cestinone";
import { CHANNEL_META, TRIGGER_META, PARTNER_TYPE_META } from "./meta";
import { CheckRow } from "./AgentBadge";

export function PreviewTab({ item }: { item: CestinoItem }): React.ReactElement {
  const ch = CHANNEL_META[item.channel] ?? CHANNEL_META.other;
  const isLinkedIn = item.channel === "linkedin";
  const charCount = (item.bodyText ?? "").length;
  const limit = isLinkedIn ? 300 : null;
  return (
    <div className="space-y-3">
      {item.channel === "email" && (
        <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-1">
          <div className="flex gap-2"><span className="text-muted-foreground w-12 shrink-0">A:</span><span className="font-medium truncate">{item.recipientHandle ?? "—"}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-12 shrink-0">Oggetto:</span><span className="font-medium">{item.subject ?? "—"}</span></div>
        </div>
      )}
      {(item.channel === "whatsapp" || item.channel === "linkedin") && (
        <div className="flex items-center gap-2 text-xs">
          <ch.Icon className={cn("h-3.5 w-3.5", ch.tone)} />
          <span className="text-muted-foreground">a</span>
          <span className="font-medium">{item.recipientHandle ?? "—"}</span>
          {limit && (
            <span className={cn("ml-auto text-[10px]", charCount > limit ? "text-destructive" : "text-muted-foreground")}>
              {charCount}/{limit} caratteri
            </span>
          )}
        </div>
      )}

      {item.bodyHtml ? (
        <div
          className="text-sm prose prose-sm dark:prose-invert max-w-none rounded-md border bg-background p-4"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.bodyHtml) }}
        />
      ) : item.bodyText ? (
        <pre className="text-sm whitespace-pre-wrap font-sans rounded-md border bg-background p-4">{item.bodyText}</pre>
      ) : item.preview ? (
        <p className="text-sm text-muted-foreground italic rounded-md border bg-background p-4">{item.preview}</p>
      ) : (
        <div className="text-sm text-muted-foreground italic rounded-md border border-dashed p-6 text-center">
          Nessuna anteprima disponibile per questa azione.
        </div>
      )}
    </div>
  );
}

export function OriginTab({ item, onOpenOrigin }: { item: CestinoItem; onOpenOrigin: () => void }): React.ReactElement {
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  const oc = item.originContext;
  const ORIGIN_ICON: Record<string, typeof Mail> = {
    business_card: IdCard,
    campaign: Megaphone,
    inbound_reply: ArrowUpRight,
    manual: Pencil,
    import: FileText,
    unknown: Bot,
  };
  const OriginIcon = ORIGIN_ICON[oc.source] ?? Bot;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-muted", tr.tone)}>
            <OriginIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Perché stiamo scrivendo</div>
            <div className="text-sm font-semibold mt-0.5">{tr.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{oc.label}</div>
          </div>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onOpenOrigin}>
            <ExternalLink className="h-3 w-3" /> Apri origine
          </Button>
        </div>

        {item.campaignName && (
          <div className="flex items-center gap-2 text-xs border-t pt-3">
            <Megaphone className="h-3.5 w-3.5 text-fuchsia-500" />
            <span className="text-muted-foreground">Campagna:</span>
            <span className="font-medium">{item.campaignName}</span>
          </div>
        )}

        {oc.source === "business_card" && (
          <div className="space-y-1.5 text-xs border-l-2 border-primary/40 pl-3 mt-2">
            {oc.eventName && <div className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> {oc.eventName}</div>}
            {oc.meetingLocation && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {oc.meetingLocation}</div>}
            {oc.acquiredAt && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Incontrato il {format(new Date(oc.acquiredAt), "dd MMM yyyy", { locale: itLocale })}</div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t pt-3">
          <div className="text-muted-foreground">Agente AI</div>
          <div className="font-medium truncate flex items-center gap-1.5">
            {item.agentName ? (
              <>
                {(() => {
                  const av = resolveAgentAvatar(item.agentName);
                  return av
                    ? <img src={av} alt="" className="h-4 w-4 rounded-full object-cover ring-1 ring-background" />
                    : <Bot className="h-3.5 w-3.5 text-muted-foreground" />;
                })()}
                <span className="capitalize truncate">{item.agentName}</span>
              </>
            ) : "—"}
          </div>
          <div className="text-muted-foreground">Creato</div>
          <div>{format(new Date(item.createdAt), "dd MMM yyyy HH:mm", { locale: itLocale })}</div>
          {item.scheduledAt && <>
            <div className="text-muted-foreground">Schedulato</div>
            <div>{format(new Date(item.scheduledAt), "dd MMM yyyy HH:mm", { locale: itLocale })}</div>
          </>}
        </div>
      </div>

      {item.previousMessage && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <ArrowUpRight className="h-4 w-4 text-success" />
            <span>Messaggio originale a cui stiamo rispondendo</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {format(new Date(item.previousMessage.date), "dd MMM yyyy HH:mm", { locale: itLocale })}
            </span>
          </div>
          {item.previousMessage.subject && (
            <div className="text-sm font-medium">{item.previousMessage.subject}</div>
          )}
          {item.previousMessage.snippet && (
            <blockquote className="text-xs text-muted-foreground border-l-4 border-success/40 pl-3 py-1 italic whitespace-pre-wrap">
              {item.previousMessage.snippet}
            </blockquote>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryTab({ item }: { item: CestinoItem }): React.ReactElement {
  if (item.recentInteractions.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground italic">
        Nessuna interazione registrata.<br />
        Sarebbe il primo contatto con questo destinatario.
      </div>
    );
  }
  return (
    <ol className="relative border-l-2 border-border ml-2 space-y-3">
      {item.recentInteractions.map((i, idx) => (
        <li key={idx} className="ml-4 pb-1">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
          <div className="flex items-center gap-2 text-xs mb-1">
            <Send className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium uppercase text-[10px] tracking-wide">{i.channel}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border text-muted-foreground">{i.direction === "in" ? "in" : i.direction === "out" ? "out" : "nota"}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {i.date ? format(new Date(i.date), "dd MMM yyyy", { locale: itLocale }) : ""}
            </span>
          </div>
          {i.subject && <div className="text-sm font-medium truncate">{i.subject}</div>}
          {i.snippet && <div className="text-xs text-muted-foreground line-clamp-2">{i.snippet}</div>}
        </li>
      ))}
    </ol>
  );
}

export function ChecksTab({ item, onRunSherlock }: { item: CestinoItem; onRunSherlock: () => void }): React.ReactElement {
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Controlli pre-invio
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CheckRow ok={!!item.partnerId} label="Partner CRM collegato" />
          <CheckRow ok={!!item.deepSearchDoneAt} label="Deep Search Sherlock" detail={item.deepSearchDoneAt ? `Fatta ${format(new Date(item.deepSearchDoneAt), "dd MMM", { locale: itLocale })}` : "Mai eseguita"} />
          <CheckRow ok={!!item.agentName} label="Agente AI assegnato" detail={item.agentName ?? undefined} />
          <CheckRow ok label="Editorial review" detail="Obbligatoria all'invio" />
          <CheckRow ok={item.triggerKind === "campaign" || item.triggerKind === "inbound_reply"} label={`Routing: ${tr.label}`} />
          <CheckRow
            ok={item.retryCount === 0}
            warn={item.retryCount > 0 && item.retryCount < item.maxRetries}
            label={`Tentativi ${item.retryCount}/${item.maxRetries}`}
          />
        </div>

        {item.partnerId && !item.deepSearchDoneAt && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs w-full mt-2" onClick={onRunSherlock}>
            <Search className="h-3.5 w-3.5" /> Esegui Deep Search Sherlock prima di inviare
          </Button>
        )}
      </div>

      {item.lastError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive dark:text-destructive text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertOctagon className="h-3.5 w-3.5" /> Ultimo errore
          </div>
          <div>{item.lastError}</div>
        </div>
      )}
    </div>
  );
}

export function RecipientTab({ item, onOpenPartner }: { item: CestinoItem; onOpenPartner: () => void }): React.ReactElement {
  const pt = item.partnerType ? PARTNER_TYPE_META[item.partnerType] : null;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          {flag && <span className="text-4xl leading-none">{flag}</span>}
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold truncate">{item.partnerName ?? item.recipientName ?? "—"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Globe className="h-3 w-3" />
              {item.partnerCountryName ?? item.partnerCountryCode ?? "Paese sconosciuto"}
              {item.partnerWcaId && <span> · WCA #{item.partnerWcaId}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {pt && <Badge variant="outline" className={cn("text-[10px] border", pt.tone)}>{pt.label}</Badge>}
          {item.partnerLeadStatus && (
            <Badge variant="outline" className="text-[10px]">Lead status: {item.partnerLeadStatus}</Badge>
          )}
        </div>

        <div className="grid grid-cols-[80px_1fr] gap-y-1.5 text-xs border-t pt-3">
          <div className="text-muted-foreground">Canale</div>
          <div className="font-medium">{CHANNEL_META[item.channel].label}</div>
          <div className="text-muted-foreground">Indirizzo</div>
          <div className="font-medium truncate">{item.recipientHandle ?? "—"}</div>
        </div>

        {item.partnerId && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs w-full" onClick={onOpenPartner}>
            <Building2 className="h-3.5 w-3.5" /> Apri scheda partner completa
          </Button>
        )}
      </div>
    </div>
  );
}
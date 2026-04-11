/**
 * InreachPage — Inbound email management with detail panel
 */
import * as React from "react";
import { useState, useMemo } from "react";
import { useInreachV2, useMarkReadV2, type InboundMessage } from "@/v2/hooks/useInreachV2";
import { Mail, ArrowDownLeft, Search, X } from "lucide-react";
import { StatusBadge } from "../atoms/StatusBadge";

const CATEGORIES = ["", "inquiry", "reply", "notification", "spam"] as const;
const CAT_LABELS: Record<string, string> = {
  "": "Tutte", inquiry: "Richieste", reply: "Risposte",
  notification: "Notifiche", spam: "Spam",
};

export function InreachPage(): React.ReactElement {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [selectedMsg, setSelectedMsg] = useState<InboundMessage | null>(null);

  const { data: messages, isLoading } = useInreachV2(search, catFilter);
  const markReadMut = useMarkReadV2();

  const unreadCount = useMemo(() => messages?.filter((m) => !m.readAt).length ?? 0, [messages]);

  const handleSelect = (msg: InboundMessage) => {
    setSelectedMsg(msg);
    if (!msg.readAt) markReadMut.mutate(msg.id);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5" />Inreach
              </h1>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Caricamento..." : `${messages?.length ?? 0} messaggi • ${unreadCount} non letti`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm text-foreground"
              placeholder="Cerca per oggetto o mittente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${catFilter === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                {CAT_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages?.map((msg) => (
            <button
              key={msg.id}
              onClick={() => handleSelect(msg)}
              className={`w-full text-left p-4 border-b hover:bg-accent/30 transition-colors ${!msg.readAt ? "bg-primary/5" : ""} ${selectedMsg?.id === msg.id ? "bg-accent" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {!msg.readAt && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                  <span className={`text-sm truncate ${!msg.readAt ? "font-semibold text-foreground" : "text-foreground"}`}>
                    {msg.fromAddress ?? "Sconosciuto"}
                  </span>
                  {msg.category ? <StatusBadge status="info" label={msg.category} /> : null}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                  {new Date(msg.createdAt).toLocaleDateString("it")}
                </span>
              </div>
              <p className="text-sm text-foreground mt-1 truncate">{msg.subject ?? "(Senza oggetto)"}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{msg.bodyText?.slice(0, 120)}</p>
            </button>
          ))}
          {!isLoading && (!messages || messages.length === 0) ? (
            <div className="text-center py-12">
              <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nessun messaggio in entrata</p>
            </div>
          ) : null}
        </div>
      </div>

      {selectedMsg ? (
        <div className="w-[55%] max-w-2xl border-l bg-card flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{selectedMsg.subject ?? "(Senza oggetto)"}</p>
              <p className="text-xs text-muted-foreground">{selectedMsg.fromAddress}</p>
            </div>
            <button onClick={() => setSelectedMsg(null)}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border-b text-xs text-muted-foreground">
            <span>{selectedMsg.channel}</span>
            <span>•</span>
            <span>{new Date(selectedMsg.createdAt).toLocaleString("it")}</span>
            {selectedMsg.category ? (
              <>
                <span>•</span>
                <StatusBadge status="info" label={selectedMsg.category} />
              </>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedMsg.bodyHtml ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedMsg.bodyHtml }}
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedMsg.bodyText ?? "Nessun contenuto"}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

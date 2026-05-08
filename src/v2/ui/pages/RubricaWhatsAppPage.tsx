import * as React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, MessageCircle } from "lucide-react";
import { useWhatsAppRubrica } from "@/v2/hooks/useWhatsAppRubrica";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";

export function RubricaWhatsAppPage(): React.ReactElement {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useWhatsAppRubrica(search);

  return (
    <PageErrorBoundary>
      <div className="p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" /> Rubrica WhatsApp
            </h1>
            <p className="text-sm text-muted-foreground">
              Contatti riconosciuti nelle conversazioni WhatsApp. Separati da CRM e LinkedIn.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">{data.length} voci</div>
        </header>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o numero…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Numero / Handle</th>
                <th className="px-3 py-2 text-left">Ultimo messaggio</th>
                <th className="px-3 py-2 text-right">In / Out</th>
                <th className="px-3 py-2 text-left">Associato a</th>
                <th className="px-3 py-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Caricamento…</td></tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nessun contatto.</td></tr>
              )}
              {data.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{r.display_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.phone_e164 ?? r.handle}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.last_message_at ? new Date(r.last_message_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="text-emerald-600">{r.messages_in_count}</span>
                    {" / "}
                    <span className="text-blue-600">{r.messages_out_count}</span>
                  </td>
                  <td className="px-3 py-2">
                    {r.linked_partner_id && r.linked_partner ? (
                      <Link
                        to={`/v2/explore/network?partner=${r.linked_partner_id}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs hover:bg-primary/20"
                      >
                        {r.linked_partner.name ?? "Partner"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/v2/inbox?channel=whatsapp&q=${encodeURIComponent(r.handle)}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Apri chat
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
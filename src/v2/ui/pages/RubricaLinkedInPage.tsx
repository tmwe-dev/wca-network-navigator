import * as React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Linkedin, ExternalLink } from "lucide-react";
import { useLinkedInRubrica } from "@/v2/hooks/useLinkedInRubrica";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";

export function RubricaLinkedInPage(): React.ReactElement {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useLinkedInRubrica(search);

  return (
    <PageErrorBoundary>
      <div className="p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Linkedin className="h-6 w-6 text-primary" /> Rubrica LinkedIn
            </h1>
            <p className="text-sm text-muted-foreground">
              Profili riconosciuti nelle conversazioni LinkedIn. Separati da CRM e WhatsApp.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">{data.length} voci</div>
        </header>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, slug o headline…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Profilo</th>
                <th className="px-3 py-2 text-left">Headline</th>
                <th className="px-3 py-2 text-left">Ultima interazione</th>
                <th className="px-3 py-2 text-right">In / Out</th>
                <th className="px-3 py-2 text-left">Associato a</th>
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
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.profile_url ? (
                      <a href={r.profile_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        {r.profile_slug} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : r.profile_slug}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">{r.headline ?? "—"}</td>
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
                        {r.linked_partner.company_name ?? "Partner"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
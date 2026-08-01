/**
 * PartnerTmweSection — sezione TMWE/Findair nel pannello dettaglio partner.
 * Mostra stato collegamento, anagrafica/listino, fatturato 12m e candidati.
 * Logic-less: usa hook in `useTmwe.ts`.
 */
import * as React from "react";
import {
  useTmwePartnerLink,
  useTmweMatchCandidates,
  useTmweSnapshot,
  useTmweRevenue,
  useLinkPartnerTmwe,
  useUnlinkPartnerTmwe,
  useResyncTmweCustomer,
} from "@/v2/hooks/useTmwe";
import { Button } from "../atoms/Button";
import { Badge } from "../atoms/Badge";
import { Loader2, Link2, Link2Off, RefreshCw, Search, Truck } from "lucide-react";

interface Props {
  readonly partnerId: string;
}

export function PartnerTmweSection({ partnerId }: Props): React.ReactElement {
  const link = useTmwePartnerLink(partnerId);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const candidates = useTmweMatchCandidates(partnerId, searchOpen && !link.data);
  const snapshot = useTmweSnapshot(link.data?.tmwe_client_id);
  const revenue = useTmweRevenue(link.data?.tmwe_client_id);
  const linkMut = useLinkPartnerTmwe(partnerId);
  const unlinkMut = useUnlinkPartnerTmwe(partnerId);
  const resyncMut = useResyncTmweCustomer();

  const total12m = React.useMemo(
    () => (revenue.data ?? []).reduce((s, r) => s + Number(r.revenue_amount || 0), 0),
    [revenue.data],
  );
  const currency = revenue.data?.[0]?.currency ?? "EUR";

  return (
    <section className="space-y-3 border-t pt-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">TMWE / Findair</h3>
        </div>
        {link.data && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => resyncMut.mutate(link.data!.tmwe_client_id)}
            disabled={resyncMut.isPending}
            title="Risincronizza"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resyncMut.isPending ? "animate-spin" : ""}`} />
          </Button>
        )}
      </header>

      {link.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifica collegamento…
        </div>
      ) : link.data ? (
        <LinkedView
          clientId={link.data.tmwe_client_id}
          confidence={link.data.match_confidence}
          snapshot={snapshot.data}
          snapshotLoading={snapshot.isLoading}
          revenueLoading={revenue.isLoading}
          total12m={total12m}
          currency={currency}
          monthsCount={revenue.data?.length ?? 0}
          onUnlink={() => {
            if (window.confirm("Rimuovere il collegamento TMWE?")) unlinkMut.mutate();
          }}
          unlinking={unlinkMut.isPending}
        />
      ) : (
        <UnlinkedView
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((v) => !v)}
          loading={candidates.isFetching}
          candidates={candidates.data?.candidates ?? []}
          onLink={(c) =>
            linkMut.mutate({
              partner_id: partnerId,
              tmwe_client_id: c.tmwe_client_id,
              tmwe_vat: c.vat,
              match_confidence: c.reason,
            })
          }
          linking={linkMut.isPending}
        />
      )}
    </section>
  );
}

function LinkedView({
  clientId, confidence, snapshot, snapshotLoading, revenueLoading,
  total12m, currency, monthsCount, onUnlink, unlinking,
}: {
  readonly clientId: string;
  readonly confidence: string;
  readonly snapshot: { denomination: string | null; vat: string | null; is_active: boolean; assigned_price_list_name: string | null; last_synced_at: string } | null | undefined;
  readonly snapshotLoading: boolean;
  readonly revenueLoading: boolean;
  readonly total12m: number;
  readonly currency: string;
  readonly monthsCount: number;
  readonly onUnlink: () => void;
  readonly unlinking: boolean;
}): React.ReactElement {
  const fmt = new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0 });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="default">ID {clientId}</Badge>
        <Badge variant="secondary">{confidence}</Badge>
        {snapshot?.is_active && <Badge variant="outline">Attivo</Badge>}
      </div>

      {snapshotLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : snapshot ? (
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <Field label="Ragione sociale" value={snapshot.denomination ?? "—"} />
          <Field label="P.IVA" value={snapshot.vat ?? "—"} />
          <Field label="Listino" value={snapshot.assigned_price_list_name ?? "—"} />
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">Snapshot in attesa del primo sync.</p>
      )}

      <div className="rounded-md border bg-muted/30 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fatturato ultimi 12 mesi</p>
        {revenueLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-1" />
        ) : (
          <p className="text-base font-semibold text-foreground">
            {fmt.format(total12m)} <span className="text-xs font-normal text-muted-foreground">· {monthsCount} mesi</span>
          </p>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onUnlink} disabled={unlinking}>
        <Link2Off className="h-3.5 w-3.5 mr-1" /> Scollega
      </Button>
    </div>
  );
}

function UnlinkedView({
  searchOpen, onToggleSearch, loading, candidates, onLink, linking,
}: {
  readonly searchOpen: boolean;
  readonly onToggleSearch: () => void;
  readonly loading: boolean;
  readonly candidates: ReadonlyArray<{ tmwe_client_id: string; denomination: string | null; vat: string | null; city: string | null; score: number; reason: string }>;
  readonly onLink: (c: { tmwe_client_id: string; vat: string | null; reason: "exact_vat" | "vies" | "name_fuzzy" }) => void;
  readonly linking: boolean;
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Nessun collegamento TMWE per questo partner.
      </p>
      <Button variant="outline" size="sm" onClick={onToggleSearch}>
        <Search className="h-3.5 w-3.5 mr-1.5" />
        {searchOpen ? "Nascondi candidati" : "Cerca su TMWE"}
      </Button>

      {searchOpen && (
        <div className="space-y-1.5 pt-1">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ricerca candidati…
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nessun candidato trovato.</p>
          ) : (
            candidates.map((c) => (
              <div key={c.tmwe_client_id} className="flex items-center justify-between gap-2 rounded-md border bg-background/50 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{c.denomination ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {[c.vat, c.city].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary">{c.reason} · {c.score}</Badge>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={linking}
                    onClick={() => onLink({ tmwe_client_id: c.tmwe_client_id, vat: c.vat, reason: c.reason as "exact_vat" | "vies" | "name_fuzzy" })}
                  >
                    <Link2 className="h-3 w-3 mr-1" /> Collega
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { readonly label: string; readonly value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground truncate">{value}</dd>
    </div>
  );
}
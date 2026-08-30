/**
 * Impostazioni — maschera Dettaglio. "Come è configurato il sistema?"
 * Fotografia di caselle, operatori e chiavi di sistema. Sola lettura.
 */
import * as React from "react";
import { Loader2, RefreshCw, Settings2 } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useImpostazioni } from "../useImpostazioni";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function dataOra(value: string | null): string {
  if (!value) return "mai";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "mai";
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titolo}</h2>
      {children}
    </section>
  );
}

export function ImpostazioniPage(): React.ReactElement {
  const { dati, isLoading, isFetching, error, ricercaChiave, setRicercaChiave, refetch } = useImpostazioni();

  const workflow = (
    <>
      <RailGroup label="Aree">
        <p className="text-xs text-muted-foreground">Caselle: {dati?.caselle.length ?? 0}</p>
        <p className="text-xs text-muted-foreground">Operatori: {dati?.operatori.length ?? 0}</p>
        <p className="text-xs text-muted-foreground">
          Chiavi di sistema: {(dati?.chiaviTotali ?? 0).toLocaleString("it-IT")}
        </p>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={refetch}>
          <RefreshCw className="h-3.5 w-3.5" />
          Aggiorna
        </Button>
      </RailGroup>

      <RailGroup label="Modifiche">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Questa maschera mostra la configurazione reale. Le modifiche restano nelle maschere dedicate finché non le
          innestiamo in V3.
        </p>
      </RailGroup>
    </>
  );

  const toolbar = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Settings2 className="h-3.5 w-3.5" />
        Configurazione di sistema
      </span>
      {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </>
  );

  return (
    <PageFrame pageId="impostazioni" workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento configurazione…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile leggere la configurazione: {error.message}
        </div>
      ) : dati ? (
        <>
          <Sezione titolo="Caselle di posta">
            {dati.caselle.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna casella configurata.</p>
            ) : (
              <ul className="space-y-2">
                {dati.caselle.map((casella) => (
                  <li key={casella.id} className="rounded-md border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{casella.etichetta}</span>
                      <Badge variant={casella.attiva ? "secondary" : "outline"} className="text-[11px]">
                        {casella.attiva ? "attiva" : "disattivata"}
                      </Badge>
                      {casella.reparto && (
                        <Badge variant="outline" className="text-[11px]">
                          {casella.reparto}
                        </Badge>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        ultima sincronizzazione {dataOra(casella.ultimaSync)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{casella.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      IMAP {casella.imapHost ?? "—"} · SMTP {casella.smtpHost ?? "—"}
                      {casella.rispondiA ? ` · risposte a ${casella.rispondiA}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Sezione>

          <Sezione titolo="Operatori">
            <ul className="grid gap-2 sm:grid-cols-2">
              {dati.operatori.map((op) => (
                <li key={op.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{op.nome}</span>
                    {!op.attivo && (
                      <Badge variant="outline" className="text-[11px]">
                        inattivo
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{op.email ?? "nessuna email"}</p>
                </li>
              ))}
            </ul>
          </Sezione>

          <Sezione titolo="Chiavi di sistema">
            <Input
              value={ricercaChiave}
              onChange={(event) => setRicercaChiave(event.target.value)}
              placeholder="Cerca una chiave (es. ai, alert, brand)"
              className="mb-2 h-8 max-w-sm text-xs"
            />
            {dati.chiavi.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna chiave con questo filtro.</p>
            ) : (
              <ul className="space-y-1">
                {dati.chiavi.map((chiave, indice) => (
                  <li key={`${chiave.chiave}-${indice}`} className="rounded-md border border-border px-3 py-2">

                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{chiave.chiave}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{dataOra(chiave.aggiornataIl)}</span>
                    </div>
                    <p className="line-clamp-2 break-words text-[11px] text-muted-foreground">{chiave.valore}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Mostrate al massimo 100 chiavi su {dati.chiaviTotali.toLocaleString("it-IT")}: usa la ricerca per
              restringere.
            </p>
          </Sezione>
        </>
      ) : null}
    </PageFrame>
  );
}

export default ImpostazioniPage;

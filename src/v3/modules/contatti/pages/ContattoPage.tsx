/**
 * Scheda contatto — maschera Dettaglio. "Chi è e cosa ci siamo detti?"
 */
import * as React from "react";
import { useParams } from "react-router-dom";
import { Loader2, Mail, MessageSquare, Send, Trash2, CalendarClock, Merge } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IntestazioneEntita } from "@/v3/ui/IntestazioneEntita";
import { StatoCircuitoBadge, InterazioniBadge } from "@/v3/ui/StatoBadge";
import { useContatto } from "../useContatto";
import { etichettaStato } from "../statiLead";


function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function Sezione({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function formatData(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ContattoPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { contatto, interazioni, isLoading, nonTrovato, error } = useContatto(id);

  const workflow = (
    <div className="space-y-1.5">
      <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
        <Send className="h-3.5 w-3.5" />
        Scrivi
      </Button>
      <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
        <CalendarClock className="h-3.5 w-3.5" />
        Programma
      </Button>
      <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
        <Merge className="h-3.5 w-3.5" />
        Unisci
      </Button>
      <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
        <Trash2 className="h-3.5 w-3.5" />
        Archivia
      </Button>
      <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
        Le azioni si attivano con il Modulo 5 (Risposta) e il Modulo 6 (Programmazione).
      </p>
    </div>
  );

  return (
    <PageFrame
      pageId="contatto"
      parent={{ label: "Contatti", to: "/v3/contatti" }}
      titleOverride={contatto?.nome ?? contatto?.email ?? "Scheda contatto"}
      workflow={workflow}
    >
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento scheda…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare il contatto: {error.message}
        </div>
      ) : nonTrovato || !contatto ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Contatto non trovato, oppure spostato nel cestino.
        </div>
      ) : (
        <div className="space-y-4">
          <IntestazioneEntita
            nome={contatto.nome ?? contatto.email ?? "Contatto senza nome"}
            ruolo={contatto.ruolo}
            azienda={contatto.partnerNome ?? contatto.azienda}
            citta={contatto.citta}
            paese={contatto.paese}
            email={contatto.email}
            badge={
              <>
                <StatoCircuitoBadge stato={contatto.stato} />
                <InterazioniBadge numero={contatto.interazioni} />
              </>
            }
          />

          <Sezione title="Recapiti">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo
                label="Email"
                value={
                  contatto.email ? (
                    <a href={`mailto:${contatto.email}`} className="text-primary hover:underline">
                      {contatto.email}
                    </a>
                  ) : null
                }
              />
              <Campo label="Telefono" value={contatto.telefono ?? contatto.mobile} />
              <Campo label="Indirizzo" value={contatto.indirizzo} />
            </div>
          </Sezione>

          <Sezione title="Stato commerciale">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[11px]">
                {contatto.stato ? etichettaStato(contatto.stato) : "senza stato"}
              </Badge>
              {contatto.punteggio !== null && (
                <Badge variant="outline" className="text-[11px]">
                  Punteggio {contatto.punteggio}
                </Badge>
              )}
              {contatto.statoEmail && (
                <Badge variant="outline" className="text-[11px]">
                  Email: {contatto.statoEmail}
                </Badge>
              )}
              <Separator orientation="vertical" className="mx-1 h-4" />
              <span className="text-xs text-muted-foreground">
                {contatto.interazioni} interazioni · ultima {formatData(contatto.ultimaInterazione)}
              </span>
            </div>
            {contatto.origine && (
              <p className="mt-2 text-xs text-muted-foreground">Origine: {contatto.origine}</p>
            )}
          </Sezione>


          {contatto.note && (
            <Sezione title="Note">
              <p className="whitespace-pre-wrap text-sm text-foreground">{contatto.note}</p>
            </Sezione>
          )}

          <Sezione title="Storia">
            {interazioni.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna interazione registrata su questo contatto.</p>
            ) : (
              <ul className="space-y-2">
                {interazioni.map((item) => (
                  <li key={item.id} className="flex gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <span className="mt-0.5 text-muted-foreground">
                      {item.tipo === "email" ? (
                        <Mail className="h-3.5 w-3.5" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{item.titolo ?? item.tipo ?? "Interazione"}</p>
                      {item.descrizione && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{item.descrizione}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatData(item.data)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Sezione>
        </div>
      )}
    </PageFrame>
  );
}

export default ContattoPage;

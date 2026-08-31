/**
 * Conversazione — maschera Dettaglio. "Cosa dice questo messaggio e cosa faccio?"
 *
 * Il corpo HTML è reso in iframe sandboxed (`CorpoEmail`), con immagini remote
 * bloccate finché l'operatore non le abilita. Niente script, niente tracking.
 */
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, CalendarClock, ImageOff, Image, Loader2, Send, Tags, TriangleAlert } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CorpoEmail } from "@/v3/ui/CorpoEmail";
import { useConversazione } from "../useConversazione";
import { dataEstesa, dataMessaggio, etichettaCanale, mittente } from "../canali";

function Sezione({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function ConversazionePage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { messaggio, thread, isLoading, nonTrovato, error } = useConversazione(id);
  const [mostraHtml, setMostraHtml] = React.useState(true);
  const [mostraImmagini, setMostraImmagini] = React.useState(false);

  const workflow = (
    <div className="space-y-1.5">
      <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
        <Send className="h-3.5 w-3.5" />
        Rispondi
      </Button>
      <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
        <CalendarClock className="h-3.5 w-3.5" />
        Programma
      </Button>
      <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
        <Tags className="h-3.5 w-3.5" />
        Classifica
      </Button>
      <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
        <TriangleAlert className="h-3.5 w-3.5" />
        Escala
      </Button>
      {messaggio?.partnerId && (
        <>
          <Separator className="my-2" />
          <Button asChild variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 text-xs">
            <Link to={`/v3/contatti?ricerca=${encodeURIComponent(messaggio.da ?? "")}`}>
              <ArrowUpRight className="h-3.5 w-3.5" />
              Cerca il contatto
            </Link>
          </Button>
        </>
      )}
      <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
        Le azioni si attivano con il Modulo 4 (Comprensione) e il Modulo 5 (Risposta).
      </p>
    </div>
  );

  return (
    <PageFrame
      pageId="conversazione"
      parent={{ label: "Inbox", to: "/v3/inbox" }}
      titleOverride={messaggio?.oggetto ?? "Conversazione"}
      workflow={workflow}
    >
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento messaggio…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare il messaggio: {error.message}
        </div>
      ) : nonTrovato || !messaggio ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Messaggio non trovato, oppure spostato nel cestino.
        </div>
      ) : (
        <div className="space-y-4">
          <Sezione title="Intestazione">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[11px]">
                {etichettaCanale(messaggio.canale)}
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                {messaggio.direzione === "outbound" ? "Inviato" : "Ricevuto"}
              </Badge>
              {messaggio.categoria && (
                <Badge variant="secondary" className="text-[11px]">
                  {messaggio.categoria}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{dataEstesa(messaggio.data)}</span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Da</dt>
                <dd className="truncate text-foreground">{mittente(messaggio.daNome, messaggio.da)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">A</dt>
                <dd className="truncate text-foreground">{messaggio.a ?? "—"}</dd>
              </div>
              {messaggio.cc && (
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Cc</dt>
                  <dd className="truncate text-foreground">{messaggio.cc}</dd>
                </div>
              )}
              {messaggio.cartella && (
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Cartella</dt>
                  <dd className="truncate text-foreground">{messaggio.cartella}</dd>
                </div>
              )}
            </dl>
          </Sezione>

          <Sezione title="Contenuto">
            {messaggio.corpoHtml && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Button
                  variant={mostraHtml ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMostraHtml(true)}
                >
                  Formattata
                </Button>
                <Button
                  variant={mostraHtml ? "outline" : "secondary"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMostraHtml(false)}
                  disabled={!messaggio.corpoTesto}
                >
                  Testo semplice
                </Button>
                {mostraHtml && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => setMostraImmagini((v) => !v)}
                  >
                    {mostraImmagini ? (
                      <ImageOff className="h-3.5 w-3.5" />
                    ) : (
                      <Image className="h-3.5 w-3.5" />
                    )}
                    {mostraImmagini ? "Nascondi immagini" : "Mostra immagini"}
                  </Button>
                )}
              </div>
            )}
            {mostraHtml && messaggio.corpoHtml ? (
              <CorpoEmail html={messaggio.corpoHtml} mostraImmaginiRemote={mostraImmagini} />
            ) : messaggio.corpoTesto ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {messaggio.corpoTesto}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nessun contenuto disponibile.</p>
            )}
          </Sezione>

          {thread.length > 0 && (
            <Sezione title={`Resto della conversazione (${thread.length})`}>
              <ul className="space-y-2">
                {thread.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/v3/inbox/${item.id}`}
                      className="flex gap-3 rounded-md border border-border/60 p-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {mittente(item.daNome, item.da)} · {item.oggetto ?? "(senza oggetto)"}
                        </p>
                        {item.anteprima && (
                          <p className="line-clamp-1 text-xs text-muted-foreground">{item.anteprima}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {dataMessaggio(item.data)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Sezione>
          )}
        </div>
      )}
    </PageFrame>
  );
}

export default ConversazionePage;

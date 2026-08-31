/**
 * Command — maschera Operativa. "Chiedi qualsiasi cosa al sistema."
 * Dialogo con il cervello esistente; le azioni restano proposte.
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useCommand } from "../useCommand";

/** Percorsi V3 citati dall'assistente: diventano tasti "Apri". */
function percorsiCitati(testo: string): string[] {
  const trovati = testo.match(/\/v3\/[a-z0-9/_-]+/gi) ?? [];
  return Array.from(new Set(trovati.map((p) => p.replace(/[.,;:)]+$/, "")))).slice(0, 4);
}


function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function dataOra(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Domande di partenza: coprono le funzioni principali del sistema. */
const SUGGERIMENTI: readonly string[] = [
  "Quali contatti hanno risposto negli ultimi 7 giorni?",
  "Cosa devo fare oggi in base allo storico delle interazioni?",
  "Prepara un messaggio per i contatti nel circuito di attesa",
  "Quante aziende ho per paese?",
];

export function CommandPage(): React.ReactElement {
  const {
    messaggi,
    bozza,
    setBozza,
    invia,
    isPending,
    errore,
    conversazioni,
    conversazioneAttiva,
    apriConversazione,
    nuovaConversazione,
  } = useCommand();
  const fine = React.useRef<HTMLDivElement | null>(null);
  const naviga = useNavigate();


  React.useEffect(() => {
    fine.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messaggi.length, isPending]);

  const filters = (
    <RailGroup label="Conversazioni recenti">
      {conversazioni.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessuna conversazione registrata.</p>
      ) : (
        <ul className="space-y-1">
          {conversazioni.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => apriConversazione(c.id)}
                className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                  conversazioneAttiva === c.id
                    ? "border-primary/60 bg-primary/10"
                    : "border-border hover:bg-accent/30"
                }`}
              >
                <p className="truncate text-xs text-foreground">{c.titolo}</p>
                <p className="text-[11px] text-muted-foreground">{dataOra(c.aggiornataIl)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </RailGroup>
  );

  const workflow = (
    <>
      <RailGroup label="Sessione">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-start gap-2 text-xs"
          onClick={nuovaConversazione}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Nuova conversazione
        </Button>
        <p className="text-xs text-muted-foreground">
          {messaggi.length} messaggi · {conversazioneAttiva ? "salvata" : "non ancora salvata"}
        </p>
      </RailGroup>

      <RailGroup label="Azioni proposte">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Command in V3 risponde e propone. Nessun invio, aggiornamento o operazione massiva parte da questa maschera:
          le azioni continuano a passare dalle Approvazioni.
        </p>
      </RailGroup>
    </>
  );

  const toolbar = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        Cervello di sistema
      </span>
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </>
  );

  return (
    <PageFrame pageId="command" filters={filters} workflow={workflow} toolbar={toolbar}>
      <div className="flex h-full min-h-[50vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pb-3">
          {messaggi.length === 0 ? (
            <div className="space-y-3 rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
              <p>Chiedi qualsiasi cosa: contatti, messaggi, regole, stato del sistema.</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SUGGERIMENTI.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setBozza(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messaggi.map((m, i) => {
              const percorsi = m.ruolo === "assistant" ? percorsiCitati(m.contenuto) : [];
              return (
                <div
                  key={`${m.ruolo}-${i}`}
                  className={`max-w-[85%] rounded-md border px-3 py-2 text-sm ${
                    m.ruolo === "user"
                      ? "ml-auto border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-muted/40 text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.contenuto}</p>
                  {percorsi.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                      {percorsi.map((p) => (
                        <Button
                          key={p}
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => naviga(p)}
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          Apri {p}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })

          )}
          {isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sto pensando…
            </div>
          )}
          {errore && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {errore}
            </div>
          )}
          <div ref={fine} />
        </div>

        <div className="flex items-end gap-2 border-t border-border pt-3">
          <Textarea
            value={bozza}
            onChange={(event) => setBozza(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                invia();
              }
            }}
            placeholder="Scrivi la tua domanda… (Invio per inviare, Shift+Invio per andare a capo)"
            className="min-h-[60px] flex-1 text-sm"
          />
          <Button onClick={invia} disabled={isPending || bozza.trim().length === 0} className="gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Invia
          </Button>
        </div>
      </div>
    </PageFrame>
  );
}

export default CommandPage;
